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

        return Response(VentaSerializer(venta).data, status=status.HTTP_201_CREATED)
