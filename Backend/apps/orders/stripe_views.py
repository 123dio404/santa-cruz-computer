"""
stripe_views.py — Pago con tarjeta vía Stripe Checkout

FLUJO (cobro en Bolivianos, modo TEST):
  1. El cliente arma su carrito y elige "Tarjeta".
  2. Frontend → POST /orders/stripe/create-checkout-session/ con el pedido.
     · Aquí NO se crea la venta todavía.
     · Se crea una Checkout Session de Stripe por el monto total (en BOB).
     · El pedido (cliente, detalles, descuento) se guarda en la METADATA de la
       sesión de Stripe — así no hace falta ninguna tabla/columna nueva.
     · Se devuelve la URL de pago hospedada por Stripe.
  3. El cliente paga en la página de Stripe.
  4. Stripe lo redirige a /payment-success?session_id=... en el frontend.
  5. Frontend → POST /orders/stripe/confirm/ con el session_id.
     · Se verifica con Stripe que la sesión esté PAGADA.
     · RECIÉN AQUÍ se crea la venta (estado 'pending') reconstruyéndola desde la
       metadata → los triggers descuentan stock, igual que una venta normal.
     · Queda 'pending' porque el cliente debe ir a la tienda a RECOGER el
       producto; un vendedor/admin dará "Confirmar Entrega" cuando lo recoja.

IDEMPOTENCIA:
  Tras crear la venta, se guarda su id en la metadata de la sesión
  (metadata.venta_id). Si /confirm/ se llama dos veces (ej. el cliente recarga la
  página de éxito), la segunda vez detecta venta_id y devuelve la venta existente
  sin volver a crearla ni descontar stock de nuevo.

NOTA: No se usa webhook por ahora. La confirmación ocurre cuando el cliente vuelve
del pago. Si el cliente cierra el navegador justo después de pagar y antes de
volver, la venta no se crea (caso borde aceptable en modo demo/TEST).
"""
import json

import stripe
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.utils import log_action, actor_from_request
from apps.users.permissions import IsAuthenticatedJWT

from .serializers import VentaCreateSerializer, VentaSerializer


def _stripe():
    """Configura y devuelve el módulo stripe con la clave secreta."""
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def _encode_detalles(detalles):
    """Codifica los ítems del carrito de forma compacta para la metadata de Stripe.

    Formato: "producto:cantidad:precio;producto:cantidad:precio".
    La metadata de Stripe limita cada valor a 500 caracteres.
    """
    return ';'.join(
        f"{int(d['producto'])}:{int(d['cantidad'])}:{float(d['precio_unitario'])}"
        for d in detalles
    )


def _decode_detalles(raw):
    """Reconstruye la lista de detalles desde el string compacto de la metadata."""
    detalles = []
    for chunk in (raw or '').split(';'):
        if not chunk:
            continue
        producto, cantidad, precio = chunk.split(':')
        detalles.append({
            'producto': int(producto),
            'cantidad': int(cantidad),
            'precio_unitario': float(precio),
        })
    return detalles


class CreateCheckoutSessionView(APIView):
    """POST /orders/stripe/create-checkout-session/

    Body esperado (igual que el de crear venta, pero sin 'pagos'):
      {
        "cliente": <id>,
        "detalles": [{"producto", "cantidad", "precio_unitario"}, ...],
        "monto": <total a cobrar en Bs>,
        "aplicar_descuento_vip": <bool>
      }
    Devuelve: { "url": "<url de pago de Stripe>", "session_id": "cs_..." }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        if not settings.STRIPE_SECRET_KEY:
            return Response(
                {'error': 'Stripe no está configurado (falta STRIPE_SECRET_KEY).'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        data = request.data
        cliente_id = data.get('cliente')
        detalles = data.get('detalles') or []
        monto = data.get('monto')
        aplicar_descuento = bool(data.get('aplicar_descuento_vip', True))

        if not cliente_id or not detalles or monto is None:
            return Response(
                {'error': 'Faltan datos del pedido (cliente, detalles o monto).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            monto = float(monto)
        except (TypeError, ValueError):
            return Response({'error': 'Monto inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        if monto <= 0:
            return Response({'error': 'El monto debe ser mayor a 0.'}, status=status.HTTP_400_BAD_REQUEST)

        # Stripe maneja los montos en la unidad mínima (centavos) como entero.
        amount_cents = int(round(monto * 100))

        detalles_encoded = _encode_detalles(detalles)
        if len(detalles_encoded) > 480:
            return Response(
                {'error': 'El pedido tiene demasiados ítems para procesar el pago. '
                          'Reduce la cantidad de productos distintos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            session = _stripe().checkout.Session.create(
                mode='payment',
                line_items=[{
                    'price_data': {
                        'currency': settings.STRIPE_CURRENCY,
                        'product_data': {'name': 'Pedido - Santa Cruz Computer'},
                        'unit_amount': amount_cents,
                    },
                    'quantity': 1,
                }],
                success_url=f"{settings.FRONTEND_URL}/payment-success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{settings.FRONTEND_URL}/cart",
                metadata={
                    'cliente_id': str(cliente_id),
                    'detalles': detalles_encoded,
                    'aplicar_descuento_vip': '1' if aplicar_descuento else '0',
                    'monto': str(monto),
                },
            )
        except Exception as e:
            return Response({'error': f'Error al crear la sesión de pago: {e}'},
                            status=status.HTTP_502_BAD_GATEWAY)

        return Response({'url': session.url, 'session_id': session.id})


def _enviar_recibo_pago(venta):
    """CU22: envía el recibo de pago (Stripe) al cliente. El producto queda
    pendiente de entrega; la factura se envía luego, al completar. No rompe el flujo."""
    cli = getattr(venta, 'cliente', None)
    if not (cli and getattr(cli, 'correo', '')):
        return
    try:
        from django.conf import settings as _s
        from apps.users.views import _send_brevo_email, _email_html
        cli_nombre = f'{cli.nombre} {cli.apellido}'.strip()
        filas = ''
        for d in venta.detalles.all():
            nombre_prod = d.producto.nombre if d.producto else f'Producto #{d.producto_id}'
            filas += (
                f'<tr><td style="padding:6px;border-bottom:1px solid #eee;">{nombre_prod}</td>'
                f'<td style="padding:6px;border-bottom:1px solid #eee;text-align:center;">{d.cantidad}</td>'
                f'<td style="padding:6px;border-bottom:1px solid #eee;text-align:right;">Bs {float(d.subtotal):.2f}</td></tr>'
            )
        tabla = (
            '<table width="100%" style="border-collapse:collapse;font-size:13px;margin:10px 0;">'
            '<tr style="background:#1e40af;color:#fff;">'
            '<td style="padding:6px;">Producto</td>'
            '<td style="padding:6px;text-align:center;">Cant.</td>'
            '<td style="padding:6px;text-align:right;">Subtotal</td></tr>'
            f'{filas}</table>'
        )
        cuerpo = (
            '<p style="color:#16a34a;font-weight:bold;font-size:16px;margin:0 0 8px;">✅ Pago confirmado</p>'
            f'<p><strong>N° de pago:</strong> #ST-{venta.id}<br>'
            '<strong>Método:</strong> 💳 Tarjeta (Stripe)</p>'
            f'{tabla}'
            f'<p style="text-align:right;font-size:15px;"><strong>Total pagado: Bs {float(venta.monto_total or 0):.2f}</strong></p>'
            '<p style="background:#fff7ed;border:1px solid #fdba74;border-radius:6px;padding:10px;color:#9a3412;">'
            '⏳ <strong>Pendiente de entrega.</strong> Pasa por la tienda a recoger tu producto. '
            'Tu factura se emitirá cuando se complete la entrega.</p>'
        )
        html = _email_html(cli_nombre, cuerpo, 'Ver mis pedidos', f'{_s.FRONTEND_URL}/orders')
        _send_brevo_email(
            cli.correo,
            f'Recibo de pago #{venta.id} — Santa Cruz Computer',
            f'Recibimos tu pago de Bs {float(venta.monto_total or 0):.2f} (pedido #{venta.id}).',
            html,
        )
    except Exception:
        pass


class ConfirmCheckoutView(APIView):
    """POST /orders/stripe/confirm/

    Body: { "session_id": "cs_..." }
    Verifica que la sesión esté pagada y crea la venta (pending).
    Idempotente: si ya se creó la venta para esa sesión, la devuelve sin duplicar.
    Devuelve: la venta creada (serializada).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        if not settings.STRIPE_SECRET_KEY:
            return Response(
                {'error': 'Stripe no está configurado (falta STRIPE_SECRET_KEY).'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        session_id = request.data.get('session_id')
        if not session_id:
            return Response({'error': 'Falta session_id.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = _stripe().checkout.Session.retrieve(session_id)
        except Exception as e:
            return Response({'error': f'No se pudo recuperar la sesión de pago: {e}'},
                            status=status.HTTP_502_BAD_GATEWAY)

        # El pago debe estar confirmado.
        if session.get('payment_status') != 'paid':
            return Response(
                {'error': 'El pago aún no está confirmado.', 'payment_status': session.get('payment_status')},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        metadata = session.get('metadata') or {}

        # Idempotencia: si ya se creó la venta para esta sesión, devolverla.
        existing_id = metadata.get('venta_id')
        if existing_id:
            from .models import Venta
            try:
                venta = Venta.objects.get(pk=int(existing_id))
                return Response(VentaSerializer(venta).data, status=status.HTTP_200_OK)
            except Venta.DoesNotExist:
                pass  # se volverá a crear

        # Reconstruir el pedido desde la metadata.
        try:
            cliente_id = int(metadata['cliente_id'])
            detalles = _decode_detalles(metadata.get('detalles'))
            aplicar_descuento = metadata.get('aplicar_descuento_vip') == '1'
            monto = float(metadata.get('monto') or 0)
        except (KeyError, ValueError):
            return Response({'error': 'Los datos del pedido en la sesión son inválidos.'},
                            status=status.HTTP_400_BAD_REQUEST)

        payload = {
            'cliente': cliente_id,
            'usuario': None,
            'pedido_online': True,
            'detalles': detalles,
            'pagos': [{'monto': monto, 'metodo': 'tarjeta'}],
            'aplicar_descuento_vip': aplicar_descuento,
        }

        serializer = VentaCreateSerializer(data=payload)
        try:
            serializer.is_valid(raise_exception=True)
            serializer.save()
            venta = serializer.instance
        except Exception as e:
            return Response({'error': f'No se pudo registrar la venta: {e}'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Guardar el id de la venta en la sesión para que /confirm/ sea idempotente.
        try:
            _stripe().checkout.Session.modify(
                session_id,
                metadata={**metadata, 'venta_id': str(venta.id)},
            )
        except Exception:
            pass  # no es crítico; la venta ya quedó creada

        actor = actor_from_request(request)
        cliente_login = (
            venta.cliente.usuario_login if venta.cliente and venta.cliente.usuario_login
            else (str(venta.cliente) if venta.cliente else 'sin cliente')
        )
        log_action(
            accion='VENTA', modulo='Venta',
            descripcion=(
                f'Pago con tarjeta (Stripe) confirmado — venta #{venta.id} '
                f'por {float(venta.monto_total or 0):.2f} Bs (cliente: {cliente_login})'
            ),
            **actor,
        )

        # CU22: enviar el recibo de pago al cliente (producto pendiente de entrega)
        _enviar_recibo_pago(venta)

        return Response(VentaSerializer(venta).data, status=status.HTTP_201_CREATED)


# ── CU28/CU29: pago ONLINE de una cuota de crédito ─────────────────────────────
# El cliente inicia el pago desde /mis-creditos. Si cierra la pestaña, se puede
# recuperar con el botón "¿Ya pagaste?" que llama a VerificarCuotaPendienteView
# (idempotente). No usamos webhook.

def _marcar_cuota_pagada_desde_stripe(cuota, session):
    """
    Marca una cuota como pagada procesando una CheckoutSession de Stripe ya
    confirmada. Actualiza saldo del plan, refresca moras, emite numero_factura,
    manda el correo con factura_cuota.html + campana. Es IDEMPOTENTE: si la
    cuota ya está pagada, no reprocesa nada.

    Devuelve el PlanCredito refrescado (para serializar la respuesta).
    """
    from decimal import Decimal
    from django.utils import timezone
    from .models import PlanCredito
    from .views import (
        _2d, _siguiente_numero_factura_credito, _render_factura_credito,
        _refrescar_moras, EMPRESA_FACTURA,
    )
    from apps.users.views import crear_notificacion

    plan = cuota.plan

    # Idempotencia: cuota ya cerrada — solo refrescamos y salimos.
    if cuota.estado == 'pagada':
        _refrescar_moras(plan)
        plan.refresh_from_db()
        return plan

    # Cierre de la cuota
    payment_intent_id = session.get('payment_intent') or ''
    cuota.estado                  = 'pagada'
    cuota.fecha_pago              = timezone.now()
    cuota.metodo_pago             = 'stripe'
    cuota.stripe_payment_intent_id = payment_intent_id
    cuota.stripe_session_pending  = None   # ya confirmada
    if not cuota.numero_factura:
        cuota.numero_factura = _siguiente_numero_factura_credito()
    cuota.save(update_fields=[
        'estado', 'fecha_pago', 'metodo_pago',
        'stripe_payment_intent_id', 'stripe_session_pending', 'numero_factura',
    ])

    # Bajar el saldo del plan (solo el capital; la mora no baja saldo)
    nuevo_saldo = _2d(Decimal(str(plan.saldo)) - Decimal(str(cuota.monto)))
    plan.saldo = nuevo_saldo if nuevo_saldo > 0 else Decimal('0.00')
    plan.save(update_fields=['saldo'])
    _refrescar_moras(plan)   # 'pagado' si todas cerradas, sino 'vigente'/'moroso'
    plan.refresh_from_db()

    # Correo con la factura de la cuota
    cliente = plan.cliente
    if cliente and getattr(cliente, 'correo', ''):
        try:
            cuotas_ordenadas = list(plan.cuotas.order_by('numero'))
            cuotas_pagadas = sum(1 for c in cuotas_ordenadas if c.estado == 'pagada')
            cuotas_restantes = plan.n_cuotas - cuotas_pagadas
            total_pagado = _2d(Decimal(str(cuota.monto)) + Decimal(str(cuota.mora)))
            # Comprobante de Stripe si el PaymentIntent tiene charge asociado
            stripe_receipt_url = None
            try:
                if payment_intent_id:
                    pi = _stripe().PaymentIntent.retrieve(payment_intent_id, expand=['latest_charge'])
                    charge = pi.get('latest_charge') or {}
                    stripe_receipt_url = charge.get('receipt_url')
            except Exception:
                pass

            producto = plan.producto
            html = _render_factura_credito('facturas/factura_cuota.html', {
                'cliente': {
                    'nombre':   f'{cliente.nombre or ""} {cliente.apellido or ""}'.strip() or 'Cliente',
                    'ci':       getattr(cliente, 'ci', None) or getattr(cliente, 'documento', None),
                    'correo':   cliente.correo,
                    'telefono': getattr(cliente, 'telefono', None),
                },
                'plan':              plan,
                'producto_nombre':   producto.nombre if producto else '—',
                'cuota':             cuota,
                'cuotas':            cuotas_ordenadas,
                'cuotas_pagadas':    cuotas_pagadas,
                'cuotas_restantes':  cuotas_restantes,
                'total_pagado':      total_pagado,
                'saldo_restante':    plan.saldo,
                'stripe_receipt_url': stripe_receipt_url,
            })
            crear_notificacion(
                tipo='credito',
                titulo=f'Pago de cuota confirmado — {cuota.numero_factura}',
                mensaje=(f'Cobramos la cuota {cuota.numero}/{plan.n_cuotas} de tu crédito '
                         f'({plan.numero_factura}) por Bs {float(total_pagado):.2f}.'),
                cliente_id=cliente.id, enlace='/mis-creditos',
                canal='ambos', email=cliente.correo, html=html,
            )
        except Exception:
            pass  # el correo no debe romper el request

    return plan


def _cliente_id_del_jwt(request):
    """Devuelve el cliente_id si el JWT es de un cliente, sino None."""
    if not request.auth:
        return None
    if request.auth.get('role') != 'cliente':
        return None
    return request.auth.get('user_id')


class CheckoutCuotaView(APIView):
    """POST /orders/stripe/checkout-cuota/

    Body: { "cuota": <id> }
    El cliente logueado inicia el pago online de UNA cuota de su crédito. Se
    valida que la cuota le pertenezca y que no esté pagada. Se crea una
    CheckoutSession por (monto + mora) y se guarda su id en
    `cuota.stripe_session_pending` para la recuperación posterior.

    Devuelve: { "url": "<url de pago>", "session_id": "cs_..." }
    """
    permission_classes = [IsAuthenticatedJWT]

    def post(self, request):
        if not settings.STRIPE_SECRET_KEY:
            return Response({'error': 'Stripe no está configurado (falta STRIPE_SECRET_KEY).'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)

        cliente_id = _cliente_id_del_jwt(request)
        if not cliente_id:
            return Response({'error': 'Este pago es solo para clientes autenticados.'},
                            status=status.HTTP_403_FORBIDDEN)

        cuota_id = request.data.get('cuota')
        if not cuota_id:
            return Response({'error': 'Falta el id de la cuota.'}, status=status.HTTP_400_BAD_REQUEST)

        from .models import Cuota as _Cuota
        try:
            cuota = _Cuota.objects.select_related('plan', 'plan__producto').get(pk=cuota_id)
        except _Cuota.DoesNotExist:
            return Response({'error': 'La cuota no existe.'}, status=status.HTTP_404_NOT_FOUND)

        if cuota.plan.cliente_id != int(cliente_id):
            return Response({'error': 'Esta cuota no pertenece al cliente autenticado.'},
                            status=status.HTTP_403_FORBIDDEN)
        if cuota.estado == 'pagada':
            return Response({'error': 'La cuota ya está pagada.'}, status=status.HTTP_400_BAD_REQUEST)

        # Monto a cobrar = capital + mora (si la cuota venció)
        monto = float(cuota.monto or 0) + float(cuota.mora or 0)
        if monto <= 0:
            return Response({'error': 'Monto de cuota inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        amount_cents = int(round(monto * 100))

        producto_nombre = cuota.plan.producto.nombre if cuota.plan.producto else 'Crédito'
        try:
            session = _stripe().checkout.Session.create(
                mode='payment',
                line_items=[{
                    'price_data': {
                        'currency': settings.STRIPE_CURRENCY,
                        'product_data': {
                            'name': f'Cuota {cuota.numero}/{cuota.plan.n_cuotas} — {producto_nombre}',
                            'description': f'Crédito {cuota.plan.numero_factura or f"#{cuota.plan_id}"}',
                        },
                        'unit_amount': amount_cents,
                    },
                    'quantity': 1,
                }],
                success_url=f"{settings.FRONTEND_URL}/mis-creditos?cuota_confirm={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{settings.FRONTEND_URL}/mis-creditos",
                metadata={
                    'cuota_id':   str(cuota.id),
                    'plan_id':    str(cuota.plan_id),
                    'cliente_id': str(cuota.plan.cliente_id),
                },
            )
        except Exception as e:
            return Response({'error': f'Error al crear la sesión de pago: {e}'},
                            status=status.HTTP_502_BAD_GATEWAY)

        # Guardamos la sesión pendiente para el fallback "¿Ya pagaste?"
        cuota.stripe_session_pending = session.id
        cuota.save(update_fields=['stripe_session_pending'])

        return Response({'url': session.url, 'session_id': session.id})


def _confirmar_pago_cuota_por_session(session_id, request_cliente_id=None):
    """
    Verifica una CheckoutSession y, si está pagada, cierra la cuota. Es
    idempotente y usable tanto por el return-URL como por el botón
    "¿Ya pagaste?". Devuelve un Response listo para retornar.
    """
    from .models import Cuota as _Cuota
    from .views import _refrescar_moras
    from .serializers import PlanCreditoSerializer as _PlanSerializer
    try:
        session = _stripe().checkout.Session.retrieve(session_id)
    except Exception as e:
        return Response({'error': f'No se pudo recuperar la sesión de pago: {e}'},
                        status=status.HTTP_502_BAD_GATEWAY)
    metadata = session.get('metadata') or {}
    try:
        cuota_id = int(metadata.get('cuota_id'))
    except (TypeError, ValueError):
        return Response({'error': 'La sesión no corresponde a una cuota de crédito.'},
                        status=status.HTTP_400_BAD_REQUEST)
    try:
        cuota = _Cuota.objects.select_related('plan', 'plan__cliente', 'plan__producto').get(pk=cuota_id)
    except _Cuota.DoesNotExist:
        return Response({'error': 'La cuota no existe.'}, status=status.HTTP_404_NOT_FOUND)

    # Autorización: si viene un cliente_id (JWT del cliente), la cuota debe ser suya
    if request_cliente_id is not None and cuota.plan.cliente_id != int(request_cliente_id):
        return Response({'error': 'Esta cuota no pertenece al cliente autenticado.'},
                        status=status.HTTP_403_FORBIDDEN)

    if session.get('payment_status') != 'paid':
        # Idempotencia: cuota ya cerrada — devolvemos el plan aunque Stripe no confirme
        if cuota.estado == 'pagada':
            _refrescar_moras(cuota.plan)
            cuota.plan.refresh_from_db()
            return Response({'estado_pago': 'ya_pagada',
                             'plan': _PlanSerializer(cuota.plan).data})
        return Response({'estado_pago': 'pendiente',
                         'payment_status': session.get('payment_status')},
                        status=status.HTTP_200_OK)

    plan = _marcar_cuota_pagada_desde_stripe(cuota, session)
    return Response({'estado_pago': 'confirmada',
                     'plan': _PlanSerializer(plan).data})


class ConfirmarCuotaView(APIView):
    """POST /orders/stripe/confirmar-cuota/

    Body: { "session_id": "cs_..." }
    Se llama al volver del return-URL de Stripe. Verifica y marca la cuota
    pagada. Idempotente: si el cliente recarga la página se responde con
    `estado_pago='ya_pagada'` sin efectos secundarios.
    """
    permission_classes = [IsAuthenticatedJWT]

    def post(self, request):
        if not settings.STRIPE_SECRET_KEY:
            return Response({'error': 'Stripe no está configurado (falta STRIPE_SECRET_KEY).'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        session_id = request.data.get('session_id')
        if not session_id:
            return Response({'error': 'Falta session_id.'}, status=status.HTTP_400_BAD_REQUEST)
        return _confirmar_pago_cuota_por_session(session_id,
                                                  request_cliente_id=_cliente_id_del_jwt(request))


class VerificarCuotaPendienteView(APIView):
    """POST /orders/stripe/verificar-cuota-pendiente/

    Body: { "cuota": <id> }
    Botón "¿Ya pagaste? Verificar" en /mis-creditos. Cuando una cuota tiene
    `stripe_session_pending` (porque el cliente cerró la pestaña sin volver
    al return-URL), este endpoint consulta a Stripe y cierra la cuota si el
    pago fue exitoso.
    """
    permission_classes = [IsAuthenticatedJWT]

    def post(self, request):
        if not settings.STRIPE_SECRET_KEY:
            return Response({'error': 'Stripe no está configurado (falta STRIPE_SECRET_KEY).'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)

        cliente_id = _cliente_id_del_jwt(request)
        if not cliente_id:
            return Response({'error': 'Solo clientes autenticados.'},
                            status=status.HTTP_403_FORBIDDEN)

        cuota_id = request.data.get('cuota')
        from .models import Cuota as _Cuota
        try:
            cuota = _Cuota.objects.select_related('plan').get(pk=cuota_id)
        except _Cuota.DoesNotExist:
            return Response({'error': 'La cuota no existe.'}, status=status.HTTP_404_NOT_FOUND)

        if cuota.plan.cliente_id != int(cliente_id):
            return Response({'error': 'Esta cuota no pertenece al cliente autenticado.'},
                            status=status.HTTP_403_FORBIDDEN)

        if not cuota.stripe_session_pending:
            return Response({'error': 'Esta cuota no tiene un pago Stripe pendiente por verificar.'},
                            status=status.HTTP_400_BAD_REQUEST)

        return _confirmar_pago_cuota_por_session(cuota.stripe_session_pending,
                                                  request_cliente_id=cliente_id)
