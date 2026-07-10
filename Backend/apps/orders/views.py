"""
views.py — Vistas del módulo de Ventas

VISTAS DISPONIBLES:
  FacturaPDFView  — Genera y descarga la factura de una venta en formato PDF
  VentaViewSet    — CRUD completo de ventas + acciones especiales
  PagoVentaViewSet — CRUD de pagos individuales
  DetalleVentaViewSet — Solo lectura de ítems de venta

ENDPOINTS ESPECIALES DE VentaViewSet:
  GET  /ventas/?cliente=<id>            → Filtrar ventas de un cliente
  PATCH /ventas/{id}/confirmar_entrega/ → Completar un pedido online (admin lo confirma)
  GET  /ventas/by_vendedor/?vendedor_id=<id> → Ventas de un vendedor específico
  GET  /ventas/historial/?vendedor_id=<id>   → Resumen estadístico del vendedor
  GET  /ventas/{id}/pdf/                → Descarga la factura en PDF (FacturaPDFView)

PDF (FacturaPDFView):
  Usa ReportLab para construir la factura. Si no existe registro en la tabla
  'factura', lo crea automáticamente con estado SIAT=PENDIENTE (integración
  con el Servicio de Impuestos Nacionales de Bolivia está pendiente).

AUDITORÍA:
  Cada venta creada y cada entrega confirmada registra un evento en la bitácora.

PERMISOS:
  permission_classes = [IsAuthenticatedJWT] → requiere un JWT válido (haber iniciado
  sesión). Nadie sin token puede leer ni operar sobre ventas, pagos, garantías,
  reseñas, devoluciones, servicios ni créditos. El detalle por rol/objeto se afina
  en el frontend y (a futuro) con filtrado por objeto.
"""
import io
from django.http import HttpResponse, Http404
from django.views import View
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import OrderingFilter
from .models import (
    Venta, DetalleVenta, PagoVenta, Factura, EstadoSiat, Garantia, Resena, Devolucion,
    ServicioCatalogo, OrdenServicio, OrdenDetalle, TareaServicio,
    PlanCredito, Cuota, ChecklistCredito,
)
from .serializers import (
    VentaSerializer, VentaCreateSerializer,
    DetalleVentaSerializer, PagoVentaSerializer, GarantiaSerializer, ResenaSerializer,
    DevolucionSerializer, ServicioCatalogoSerializer, OrdenServicioSerializer,
    PlanCreditoSerializer, CuotaSerializer,
)
from apps.audit.utils import log_action, actor_from_request
from apps.users.permissions import IsAuthenticatedJWT
from apps.users.models import Cliente
from apps.products.models import Producto
from utils import get_client_ip


class FacturaPDFView(View):
    """Descarga/visualiza la factura PDF de una venta completada usando ReportLab."""
    def get(self, request, venta_id):
        try:
            venta = (
                Venta.objects
                .prefetch_related('detalles__producto', 'pagos', 'garantias')
                .select_related('cliente', 'usuario')
                .get(pk=venta_id)
            )
        except Venta.DoesNotExist:
            raise Http404('Venta no encontrada')
        if venta.estado != 'completed':
            return HttpResponse('La factura solo está disponible para ventas completadas.', status=403)
        pdf_bytes, nro = self.construir_pdf(venta)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="factura-{nro}.pdf"'
        response['Access-Control-Allow-Origin'] = '*'
        return response

    @staticmethod
    def construir_pdf(venta):
        """Genera la factura PDF (ReportLab) → (pdf_bytes, nro). Crea el registro
        Factura si no existe. Reutilizado por la descarga y por el correo (CU22)."""
        # Registrar la factura en BD si aún no existe (SIAT pendiente de integración)
        factura, _ = Factura.objects.get_or_create(
            venta=venta,
            defaults={
                'nro_factura': venta.id,
                'cuf':         f'PENDIENTE-{venta.id}',
                'cufd':        f'PENDIENTE-{venta.id}',
                'estado_siat': EstadoSiat.PENDIENTE,
            },
        )

        nro = str(factura.nro_factura).zfill(4)
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2 * cm, leftMargin=2 * cm,
            topMargin=2 * cm, bottomMargin=2 * cm,
            title=f'Factura de Venta Nº {nro}',
            author='Santa Cruz Computer',
            subject='Factura de Venta',
            creator='Sistema Santa Cruz Computer',
        )

        styles = getSampleStyleSheet()
        s_title   = ParagraphStyle('title',   fontSize=20, fontName='Helvetica-Bold', textColor=colors.HexColor('#1e3a5f'), alignment=TA_CENTER, spaceAfter=4)
        s_sub     = ParagraphStyle('sub',     fontSize=10, fontName='Helvetica',      textColor=colors.HexColor('#555555'), alignment=TA_CENTER, spaceAfter=2)
        s_section = ParagraphStyle('section', fontSize=9,  fontName='Helvetica-Bold', textColor=colors.HexColor('#1e3a5f'), spaceBefore=10, spaceAfter=4)
        s_normal  = ParagraphStyle('normal',  fontSize=9,  fontName='Helvetica',      textColor=colors.HexColor('#333333'))
        s_total   = ParagraphStyle('total',   fontSize=11, fontName='Helvetica-Bold', textColor=colors.HexColor('#1e3a5f'), alignment=TA_RIGHT)
        s_footer  = ParagraphStyle('footer',  fontSize=8,  fontName='Helvetica',      textColor=colors.HexColor('#888888'), alignment=TA_CENTER)

        # ── Datos del cliente ────────────────────────────────────────────────
        cliente = venta.cliente
        cliente_nombre   = f'{cliente.nombre} {cliente.apellido}'.strip() if cliente else 'Consumidor Final'
        cliente_nit      = (cliente.nit_ci      or '—') if cliente else '—'
        cliente_razon    = (cliente.razon_social or '—') if cliente else '—'
        cliente_correo   = (cliente.correo       or '—') if cliente else '—'

        vendedor = venta.usuario
        if vendedor:
            vendedor_nombre = f'Pedido en línea ({vendedor.username})' if venta.pedido_online else vendedor.username
        elif venta.usuario_id:
            from apps.users.models import Usuario as _U
            try:
                u = _U.objects.get(pk=venta.usuario_id)
                vendedor_nombre = f'Pedido en línea ({u.username})' if venta.pedido_online else u.username
            except _U.DoesNotExist:
                vendedor_nombre = f'Pedido en línea (Usuario #{venta.usuario_id})' if venta.pedido_online else f'Usuario #{venta.usuario_id}'
        else:
            vendedor_nombre = 'Pedido en línea'

        fecha_str = venta.fecha_venta.strftime('%d/%m/%Y %H:%M') if venta.fecha_venta else '—'

        story = []

        # ── Encabezado ───────────────────────────────────────────────────────
        story.append(Paragraph('Santa Cruz Computer', s_title))
        story.append(Paragraph('Venta de equipos y accesorios de computación', s_sub))
        story.append(Paragraph('Santa Cruz de la Sierra, Bolivia', s_sub))
        story.append(Spacer(1, 0.3 * cm))
        story.append(HRFlowable(width='100%', thickness=2, color=colors.HexColor('#1e3a5f')))
        story.append(Spacer(1, 0.3 * cm))

        # ── Info de factura y cliente lado a lado ────────────────────────────
        info_data = [
            [Paragraph('<b>FACTURA DE VENTA</b>', ParagraphStyle('h', fontSize=12, fontName='Helvetica-Bold', textColor=colors.HexColor('#1e3a5f'))),
             Paragraph(f'<b>Nº Factura:</b> {factura.nro_factura}', s_normal)],
            [Paragraph(f'<b>Fecha:</b> {fecha_str}', s_normal),
             Paragraph(f'<b>Nº Venta:</b> {venta.id}', s_normal)],
            [Paragraph(f'<b>Vendedor:</b> {vendedor_nombre}', s_normal),
             Paragraph(f'<b>Estado SIAT:</b> {factura.estado_siat}', s_normal)],
        ]
        info_table = Table(info_data, colWidths=[9 * cm, 8 * cm])
        info_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.4 * cm))

        # ── Datos del cliente ────────────────────────────────────────────────
        story.append(Paragraph('DATOS DEL CLIENTE', s_section))
        story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#cccccc')))
        story.append(Spacer(1, 0.2 * cm))

        cli_data = [
            [Paragraph(f'<b>Nombre / Razón Social:</b> {cliente_nombre}', s_normal),
             Paragraph(f'<b>Razón Social:</b> {cliente_razon}', s_normal)],
            [Paragraph(f'<b>NIT / CI:</b> {cliente_nit}', s_normal),
             Paragraph(f'<b>Correo:</b> {cliente_correo}', s_normal)],
        ]
        cli_table = Table(cli_data, colWidths=[9 * cm, 8 * cm])
        cli_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(cli_table)
        story.append(Spacer(1, 0.5 * cm))

        # ── Tabla de productos ───────────────────────────────────────────────
        story.append(Paragraph('DETALLE DE PRODUCTOS', s_section))
        story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#cccccc')))
        story.append(Spacer(1, 0.2 * cm))

        header_style = ParagraphStyle('th', fontSize=9, fontName='Helvetica-Bold', textColor=colors.white, alignment=TA_CENTER)
        cell_style   = ParagraphStyle('td', fontSize=9, fontName='Helvetica',      textColor=colors.HexColor('#333333'))
        cell_right   = ParagraphStyle('tdr', fontSize=9, fontName='Helvetica',     textColor=colors.HexColor('#333333'), alignment=TA_RIGHT)
        cell_garantia = ParagraphStyle('tdg', fontSize=7, fontName='Helvetica-Oblique', textColor=colors.HexColor('#1e3a5f'), spaceBefore=1)

        # Garantías de esta venta, indexadas por el ítem (detalle) al que pertenecen
        garantias_por_detalle = {g.detalle_id: g for g in venta.garantias.all()}

        tabla_data = [[
            Paragraph('#',              header_style),
            Paragraph('Producto',       header_style),
            Paragraph('Cant.',          header_style),
            Paragraph('Precio Unit.',   header_style),
            Paragraph('Subtotal',       header_style),
        ]]

        for i, det in enumerate(venta.detalles.all(), 1):
            nombre_prod = det.producto.nombre if det.producto else f'Producto #{det.producto_id}'
            # Celda del producto: nombre + (si tiene) línea de garantía
            prod_cell = [Paragraph(nombre_prod, cell_style)]
            g = garantias_por_detalle.get(det.id)
            if g:
                prod_cell.append(Paragraph(
                    f'Garantía: {g.fecha_inicio.strftime("%d/%m/%y")} – {g.fecha_fin.strftime("%d/%m/%y")}',
                    cell_garantia,
                ))
            tabla_data.append([
                Paragraph(str(i), cell_style),
                prod_cell,
                Paragraph(str(det.cantidad), cell_style),
                Paragraph(f'Bs {float(det.precio_unitario):.2f}', cell_right),
                Paragraph(f'Bs {float(det.subtotal):.2f}', cell_right),
            ])

        col_widths = [1 * cm, 8.5 * cm, 1.5 * cm, 3 * cm, 3 * cm]
        prod_table = Table(tabla_data, colWidths=col_widths, repeatRows=1)
        prod_table.setStyle(TableStyle([
            ('BACKGROUND',  (0, 0), (-1, 0),  colors.HexColor('#1e3a5f')),
            ('TEXTCOLOR',   (0, 0), (-1, 0),  colors.white),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#f5f8ff'), colors.white]),
            ('GRID',        (0, 0), (-1, -1), 0.4, colors.HexColor('#cccccc')),
            ('VALIGN',      (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING',  (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('ALIGN',       (2, 1), (-1, -1), 'RIGHT'),
        ]))
        story.append(prod_table)
        story.append(Spacer(1, 0.4 * cm))

        # ── Totales y pagos ──────────────────────────────────────────────────
        metodos_str = ', '.join(
            f'{p.metodo.capitalize()} Bs {float(p.monto):.2f}'
            for p in venta.pagos.all()
        ) or 'Sin registrar'

        descuento_vip = float(venta.descuento_aplicado or 0)
        subtotal_original = float(venta.monto_total) + descuento_vip

        total_data = []
        if descuento_vip > 0:
            s_descuento = ParagraphStyle(
                'descuento', fontSize=10, fontName='Helvetica-Bold',
                textColor=colors.HexColor('#16a34a'), alignment=TA_RIGHT,
            )
            total_data.append(['', Paragraph(f'Subtotal: Bs {subtotal_original:.2f}', s_normal)])
            total_data.append(['', Paragraph(f'Descuento VIP: − Bs {descuento_vip:.2f}', s_descuento)])
        total_data.append(['', Paragraph(f'<b>Método(s) de pago:</b> {metodos_str}', s_normal)])
        total_data.append(['', Paragraph(f'<b>TOTAL:</b>  Bs {float(venta.monto_total):.2f}', s_total)])
        total_table = Table(total_data, colWidths=[9 * cm, 8 * cm])
        total_table.setStyle(TableStyle([
            ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING',    (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LINEABOVE',     (1, 1), (1, 1),   1, colors.HexColor('#1e3a5f')),
        ]))
        story.append(total_table)
        story.append(Spacer(1, 1 * cm))

        # ── Pie de página ────────────────────────────────────────────────────
        story.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#1e3a5f')))
        story.append(Spacer(1, 0.2 * cm))
        story.append(Paragraph('Gracias por su compra — Santa Cruz Computer', s_footer))
        story.append(Paragraph('Este documento es válido como comprobante de venta.', s_footer))

        doc.build(story)
        return buffer.getvalue(), nro


def enviar_factura_por_correo(venta):
    """CU22: envía la factura en PDF al correo del cliente. Solo para ventas
    completadas con cliente y correo. Nunca rompe el flujo si algo falla."""
    cli = getattr(venta, 'cliente', None)
    if venta.estado != 'completed' or not (cli and getattr(cli, 'correo', '')):
        return
    try:
        from django.conf import settings as _s
        from apps.users.views import _send_brevo_email, _email_html
        pdf_bytes, nro = FacturaPDFView.construir_pdf(venta)
        cli_nombre = f'{cli.nombre} {cli.apellido}'.strip()
        html = _email_html(
            cli_nombre,
            f'<p>¡Gracias por tu compra! 🧾 Adjuntamos la <strong>factura</strong> '
            f'de tu pedido <strong>#{venta.id}</strong>.</p>'
            f'<p>Total: <strong>Bs {float(venta.monto_total or 0):.2f}</strong></p>',
            'Ver mis pedidos', f'{_s.FRONTEND_URL}/orders',
        )
        _send_brevo_email(
            cli.correo,
            f'Factura de tu compra #{venta.id} — Santa Cruz Computer',
            f'Adjuntamos la factura de tu pedido #{venta.id}.',
            html, attachment_bytes=pdf_bytes, attachment_name=f'factura-{nro}.pdf',
        )
    except Exception:
        pass


class VentaViewSet(viewsets.ModelViewSet):
    """CRUD de ventas. POST usa VentaCreateSerializer; GET usa VentaSerializer."""
    queryset          = Venta.objects.prefetch_related('detalles', 'detalles__producto', 'pagos', 'planes_credito').select_related('cliente', 'usuario')
    serializer_class  = VentaSerializer
    permission_classes = [IsAuthenticatedJWT]
    filter_backends   = [OrderingFilter]
    ordering_fields   = ['fecha_venta', 'monto_total']
    ordering          = ['-fecha_venta']

    def get_queryset(self):
        qs = super().get_queryset()
        cliente_id = self.request.query_params.get('cliente')
        if cliente_id:
            qs = qs.filter(cliente_id=cliente_id)
        return qs

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return VentaCreateSerializer
        return VentaSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            venta = serializer.instance
            actor = actor_from_request(request)
            cliente_login = (
                venta.cliente.usuario_login if venta.cliente and venta.cliente.usuario_login
                else (str(venta.cliente) if venta.cliente else 'sin cliente')
            )
            log_action(
                accion='VENTA', modulo='Venta',
                descripcion=(
                    f'Se registró la venta #{venta.id} '
                    f'por {float(venta.monto_total or 0):.2f} Bs '
                    f'(cliente: {cliente_login})'
                ),
                **actor,
            )
            # CU22: si la venta nace completada (venta en tienda), enviar la factura
            enviar_factura_por_correo(venta)
            return Response(
                VentaSerializer(venta).data,
                status=status.HTTP_201_CREATED,
                headers=self.get_success_headers(serializer.data),
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        venta = self.get_object()
        serializer = VentaSerializer(venta, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        venta.refresh_from_db()
        return Response(VentaSerializer(venta).data)

    @action(detail=True, methods=['patch'], url_path='confirmar_entrega')
    def confirmar_entrega(self, request, pk=None):
        """Cambia estado a 'completed'. Para pedidos online, registra al admin que confirmó."""
        venta = self.get_object()
        if venta.estado == 'completed':
            return Response({'error': 'La venta ya está completada.'}, status=status.HTTP_400_BAD_REQUEST)
        actor = actor_from_request(request)
        venta.estado = 'completed'
        update_fields = ['estado']
        # Si el pedido era online (sin vendedor asignado), registrar quién confirma
        if not venta.usuario_id and actor.get('usuario_id'):
            venta.usuario_id = actor['usuario_id']
            update_fields.append('usuario')
        venta.save(update_fields=update_fields)
        venta.refresh_from_db()
        log_action(
            accion='VENTA', modulo='Venta',
            descripcion=f'Se confirmó la entrega de la venta #{venta.id} (estado → completada)',
            **actor,
        )
        # CU21: invitar al cliente a dejar su reseña (campana + correo)
        cli = venta.cliente
        if cli and getattr(cli, 'correo', ''):
            from django.conf import settings as _s
            from apps.users.views import crear_notificacion, _email_html
            cli_nombre = f'{cli.nombre} {cli.apellido}'.strip()
            _html = _email_html(
                cli_nombre,
                f'<p>¡Gracias por tu compra! 🛍️ (Venta #{venta.id})</p>'
                f'<p>Nos encantaría saber cómo te fue. Tu opinión ayuda a otros clientes '
                f'y a mejorar nuestro servicio.</p>'
                f'<p style="text-align:center;font-size:20px;margin:10px 0;">⭐ ⭐ ⭐ ⭐ ⭐</p>',
                'Dejar mi reseña', f'{_s.FRONTEND_URL}/orders',
            )
            crear_notificacion(
                tipo='resena', titulo='¿Cómo te fue con tu compra?',
                mensaje=f'Déjanos tu reseña de la venta #{venta.id}.',
                cliente_id=venta.cliente_id, enlace='/orders',
                canal='ambos', email=cli.correo, html=_html,
            )
        # CU22: enviar la factura en PDF por correo al completar la entrega
        enviar_factura_por_correo(venta)
        return Response(VentaSerializer(venta).data)

    @action(detail=False, methods=['get'])
    def by_vendedor(self, request):
        vendedor_id = request.query_params.get('vendedor_id')
        if not vendedor_id:
            return Response({'error': 'vendedor_id es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        ventas = Venta.objects.filter(usuario_id=vendedor_id)
        return Response(VentaSerializer(ventas, many=True).data)

    @action(detail=False, methods=['get'])
    def historial(self, request):
        """Devuelve resumen estadístico: total de ventas, monto acumulado y lista detallada."""
        vendedor_id = request.query_params.get('vendedor_id')
        if not vendedor_id:
            return Response({'error': 'vendedor_id es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        ventas = Venta.objects.filter(usuario_id=vendedor_id).prefetch_related('detalles', 'pagos')
        total_monto = sum(float(v.monto_total or 0) for v in ventas)
        return Response({
            'total_ventas': ventas.count(),
            'total_monto': total_monto,
            'ventas': VentaSerializer(ventas, many=True).data,
        })


class PagoVentaViewSet(viewsets.ModelViewSet):
    queryset           = PagoVenta.objects.all()
    serializer_class   = PagoVentaSerializer
    permission_classes = [IsAuthenticatedJWT]
    filter_backends    = [OrderingFilter]
    ordering_fields    = ['fecha']
    ordering           = ['-fecha']


class DetalleVentaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = DetalleVenta.objects.all()
    serializer_class   = DetalleVentaSerializer
    permission_classes = [IsAuthenticatedJWT]
    filter_backends    = []


class GarantiaViewSet(viewsets.ModelViewSet):
    """
    Garantías de productos vendidos.

      GET  /garantias/?cliente=<id>   → garantías del cliente (Mis Pedidos)
      GET  /garantias/?estado=<...>   → filtro para el panel interno
      PATCH /garantias/{id}/reclamar/ → cliente reporta un problema (motivo)
      PATCH /garantias/{id}/aprobar/  → vendedor/admin: el reclamo procede
      PATCH /garantias/{id}/rechazar/ → vendedor/admin: no procede (motivo)
      POST /garantias/generar-retroactivas/ → genera las faltantes de ventas pasadas
    """
    queryset           = Garantia.objects.select_related('producto', 'cliente', 'venta', 'detalle')
    serializer_class   = GarantiaSerializer
    permission_classes = [IsAuthenticatedJWT]
    http_method_names  = ['get', 'patch', 'post', 'head', 'options']
    filter_backends    = [OrderingFilter]
    ordering_fields    = ['id', 'fecha_fin', 'fecha_reclamo']
    ordering           = ['-id']

    def get_queryset(self):
        qs = super().get_queryset()
        cliente_id = self.request.query_params.get('cliente')
        estado     = self.request.query_params.get('estado')
        if cliente_id:
            qs = qs.filter(cliente_id=cliente_id)
        if estado:
            qs = qs.filter(estado=estado)
        return qs

    @action(detail=True, methods=['patch'])
    def reclamar(self, request, pk=None):
        from django.utils import timezone
        g = self.get_object()
        if g.estado != 'activa':
            return Response({'error': 'Esta garantía ya tiene un reclamo registrado.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if g.fecha_fin < timezone.localdate():
            return Response({'error': 'La garantía está vencida; no se puede reclamar.'},
                            status=status.HTTP_400_BAD_REQUEST)
        motivo = (request.data.get('motivo') or '').strip()
        if not motivo:
            return Response({'error': 'Debes describir el motivo del reclamo.'},
                            status=status.HTTP_400_BAD_REQUEST)
        g.estado         = 'reclamada'
        g.motivo_reclamo = motivo
        g.fecha_reclamo  = timezone.now()
        g.save(update_fields=['estado', 'motivo_reclamo', 'fecha_reclamo'])
        # El cliente NO es un Usuario → idusuario None para no romper la FK de bitácora
        cli    = g.cliente
        nombre = f'{cli.nombre} {cli.apellido}'.strip() if cli else 'Cliente'
        prod   = g.producto.nombre if g.producto else 'producto'
        log_action(
            accion='UPDATE', modulo='Garantía',
            descripcion=(f'Cliente {nombre} reclamó la garantía #{g.id} '
                         f'({prod}, pedido #{g.venta_id}). Motivo: {motivo}'),
            usuario_id=None, usuario_nombre=nombre, usuario_rol='client',
            ip_address=get_client_ip(request),
        )
        # CU21: avisar al cliente que recibimos su reclamo (campana + correo)
        if cli and getattr(cli, 'correo', ''):
            from django.conf import settings as _s
            from apps.users.views import crear_notificacion, _email_html
            _html = _email_html(
                nombre,
                f'<p>Recibimos tu reclamo de garantía del <strong>{prod}</strong> '
                f'(garantía #{g.id}) y ya lo estamos revisando 🔎.</p>'
                f'<p>Te avisaremos por este medio apenas tengamos una respuesta.</p>',
                'Ver el estado', f'{_s.FRONTEND_URL}/warranties',
            )
            crear_notificacion(
                tipo='reclamo', titulo='Recibimos tu reclamo de garantía',
                mensaje=f'Tu reclamo del {prod} (garantía #{g.id}) está en revisión.',
                cliente_id=g.cliente_id, enlace='/warranties',
                canal='ambos', email=cli.correo, html=_html,
            )
        g.refresh_from_db()
        return Response(GarantiaSerializer(g).data)

    @action(detail=True, methods=['patch'])
    def aprobar(self, request, pk=None):
        return self._resolver(request, aprobar=True)

    @action(detail=True, methods=['patch'])
    def rechazar(self, request, pk=None):
        return self._resolver(request, aprobar=False)

    def _resolver(self, request, aprobar):
        from django.utils import timezone
        g = self.get_object()
        if g.estado != 'reclamada':
            return Response({'error': 'Solo se pueden resolver garantías que están reclamadas.'},
                            status=status.HTTP_400_BAD_REQUEST)
        resolucion = (request.data.get('resolucion') or '').strip()
        if not aprobar and not resolucion:
            return Response({'error': 'Debes indicar el motivo del rechazo.'},
                            status=status.HTTP_400_BAD_REQUEST)
        g.estado           = 'aprobada' if aprobar else 'rechazada'
        g.resolucion       = resolucion
        g.fecha_resolucion = timezone.now()
        g.save(update_fields=['estado', 'resolucion', 'fecha_resolucion'])
        actor = actor_from_request(request)
        verbo = 'APROBÓ' if aprobar else 'RECHAZÓ'
        prod  = g.producto.nombre if g.producto else 'producto'
        extra = f' — motivo: {resolucion}' if resolucion else ''
        log_action(
            accion='UPDATE', modulo='Garantía',
            descripcion=(f'{actor.get("usuario_nombre") or "Usuario"} {verbo} el reclamo de '
                         f'garantía #{g.id} ({prod}, pedido #{g.venta_id}){extra}'),
            **actor,
        )
        # CU21: avisar al cliente el resultado del reclamo (campana + correo)
        cli = g.cliente
        if cli and getattr(cli, 'correo', ''):
            from django.conf import settings as _s
            from apps.users.views import crear_notificacion, _email_html
            cli_nombre = f'{cli.nombre} {cli.apellido}'.strip()
            resultado  = 'APROBADO ✅' if aprobar else 'RECHAZADO'
            det        = f'<p style="margin:8px 0;">Detalle: {resolucion}</p>' if resolucion else ''
            _html = _email_html(
                cli_nombre,
                f'<p>Revisamos tu reclamo de garantía del <strong>{prod}</strong> '
                f'(garantía #{g.id}) y el resultado es: <strong>{resultado}</strong>.</p>{det}'
                f'<p>Gracias por tu confianza.</p>',
                'Ver mis garantías', f'{_s.FRONTEND_URL}/warranties',
            )
            crear_notificacion(
                tipo='reclamo_resuelto',
                titulo=f'Tu reclamo de garantía fue {"aprobado" if aprobar else "rechazado"}',
                mensaje=f'Reclamo del {prod} (garantía #{g.id}): {resultado}.',
                cliente_id=g.cliente_id, enlace='/warranties',
                canal='ambos', email=cli.correo, html=_html,
            )
        g.refresh_from_db()
        return Response(GarantiaSerializer(g).data)

    @action(detail=False, methods=['post'], url_path='generar-retroactivas')
    def generar_retroactivas(self, request):
        from .garantia_service import generar_garantias_faltantes
        total = generar_garantias_faltantes()
        actor = actor_from_request(request)
        log_action(
            accion='UPDATE', modulo='Garantía',
            descripcion=f'Se generaron {total} garantía(s) de ventas anteriores.',
            **actor,
        )
        return Response({'creadas': total})


class ResenaViewSet(viewsets.ModelViewSet):
    """
    Reseñas de la tienda (opinión por venta: atención + producto).

      GET  /resenas/?cliente=<id>  → reseñas del cliente (para Mis Pedidos)
      GET  /resenas/               → todas, incl. ocultas (moderación admin)
      GET  /resenas/publicas/      → promedio + total + lista visible (Tienda)
      POST /resenas/               → crear (valida venta del cliente y completada)
      PATCH /resenas/{id}/ocultar/ → admin oculta
      PATCH /resenas/{id}/mostrar/ → admin vuelve a mostrar
    """
    queryset           = Resena.objects.select_related('cliente', 'venta')
    serializer_class   = ResenaSerializer
    permission_classes = [IsAuthenticatedJWT]
    http_method_names  = ['get', 'post', 'patch', 'head', 'options']
    filter_backends    = [OrderingFilter]
    ordering_fields    = ['id', 'fecha', 'puntuacion']
    ordering           = ['-id']

    def get_queryset(self):
        qs = super().get_queryset()
        cliente_id = self.request.query_params.get('cliente')
        if cliente_id:
            qs = qs.filter(cliente_id=cliente_id)
        return qs

    @action(detail=False, methods=['get'])
    def publicas(self, request):
        """Resumen para la Tienda: promedio, total y lista de reseñas visibles."""
        from django.db.models import Avg, Count
        visibles = Resena.objects.filter(estado='visible').select_related('cliente')
        agg = visibles.aggregate(prom=Avg('puntuacion'), tot=Count('id'))
        return Response({
            'promedio': round(agg['prom'], 1) if agg['prom'] is not None else 0,
            'total':    agg['tot'] or 0,
            'resenas':  ResenaSerializer(visibles, many=True).data,
        })

    def create(self, request, *args, **kwargs):
        cliente_id = request.data.get('cliente')
        venta_id   = request.data.get('venta')
        try:
            puntuacion = int(request.data.get('puntuacion'))
        except (TypeError, ValueError):
            return Response({'error': 'La puntuación es obligatoria (1 a 5).'},
                            status=status.HTTP_400_BAD_REQUEST)
        comentario = (request.data.get('comentario') or '').strip() or None

        if puntuacion < 1 or puntuacion > 5:
            return Response({'error': 'La puntuación debe estar entre 1 y 5.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            venta = Venta.objects.get(pk=venta_id)
        except Venta.DoesNotExist:
            return Response({'error': 'Venta no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        if str(venta.cliente_id) != str(cliente_id):
            return Response({'error': 'Esta venta no pertenece al cliente.'},
                            status=status.HTTP_403_FORBIDDEN)
        if venta.estado != 'completed':
            return Response({'error': 'Solo puedes calificar pedidos completados.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if Resena.objects.filter(venta_id=venta_id).exists():
            return Response({'error': 'Esta compra ya tiene una calificación.'},
                            status=status.HTTP_400_BAD_REQUEST)

        resena = Resena.objects.create(
            venta_id=venta_id, cliente_id=cliente_id,
            puntuacion=puntuacion, comentario=comentario, estado='visible',
        )
        cli    = resena.cliente
        nombre = f'{cli.nombre} {cli.apellido}'.strip() if cli else 'Cliente'
        log_action(
            accion='CREATE', modulo='Reseña',
            descripcion=(f'Cliente {nombre} calificó la venta #{venta_id} con '
                         f'{puntuacion}★{(" — " + comentario) if comentario else ""}'),
            usuario_id=None, usuario_nombre=nombre, usuario_rol='client',
            ip_address=get_client_ip(request),
        )
        # CU21: avisar a los administradores que hay una nueva reseña (solo campana)
        from apps.users.views import notificar_admins
        notificar_admins(
            tipo='resena', titulo='Nueva reseña de un cliente',
            mensaje=f'{nombre} calificó la venta #{venta_id} con {puntuacion}★.',
            enlace='/reviews',
        )
        return Response(ResenaSerializer(resena).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'])
    def ocultar(self, request, pk=None):
        return self._moderar(request, 'oculto')

    @action(detail=True, methods=['patch'])
    def mostrar(self, request, pk=None):
        return self._moderar(request, 'visible')

    def _moderar(self, request, nuevo_estado):
        r = self.get_object()
        r.estado = nuevo_estado
        r.save(update_fields=['estado'])
        actor = actor_from_request(request)
        verbo = 'ocultó' if nuevo_estado == 'oculto' else 'volvió a mostrar'
        log_action(
            accion='UPDATE', modulo='Reseña',
            descripcion=(f'{actor.get("usuario_nombre") or "Admin"} {verbo} la reseña '
                         f'#{r.id} (venta #{r.venta_id})'),
            **actor,
        )
        return Response(ResenaSerializer(r).data)


class DevolucionViewSet(viewsets.ModelViewSet):
    """
    Devoluciones (RMA) — CU23. Las registra el vendedor/admin desde Historial de Ventas.

      GET  /devoluciones/            → lista (para reporte / historial)
      GET  /devoluciones/?venta=<id> → devoluciones de una venta
      POST /devoluciones/            → registrar (nace 'aprobada' o 'rechazada')
    """
    queryset           = Devolucion.objects.select_related('producto', 'cliente', 'usuario', 'venta')
    serializer_class   = DevolucionSerializer
    permission_classes = [IsAuthenticatedJWT]
    http_method_names  = ['get', 'post', 'head', 'options']
    filter_backends    = [OrderingFilter]
    ordering_fields    = ['id', 'fecha']
    ordering           = ['-id']

    DIAS_DEVOLUCION = 7

    def get_queryset(self):
        qs = super().get_queryset()
        venta_id   = self.request.query_params.get('venta')
        cliente_id = self.request.query_params.get('cliente')
        if venta_id:
            qs = qs.filter(venta_id=venta_id)
        if cliente_id:
            qs = qs.filter(cliente_id=cliente_id)
        return qs

    def create(self, request, *args, **kwargs):
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models import Sum

        detalle_id = request.data.get('detalle')
        try:
            cantidad = int(request.data.get('cantidad') or 1)
        except (TypeError, ValueError):
            return Response({'error': 'Cantidad inválida.'}, status=status.HTTP_400_BAD_REQUEST)
        motivo         = (request.data.get('motivo') or '').strip()
        aprobar        = bool(request.data.get('aprobar', True))
        motivo_rechazo = (request.data.get('motivo_rechazo') or '').strip() or None
        # Checklist de inspección física (los 4 puntos que verifica el vendedor)
        insp_sin_dano         = bool(request.data.get('insp_sin_dano', False))
        insp_sin_manipulacion = bool(request.data.get('insp_sin_manipulacion', False))
        insp_mismo_producto   = bool(request.data.get('insp_mismo_producto', False))
        insp_completo         = bool(request.data.get('insp_completo', False))

        if cantidad < 1:
            return Response({'error': 'La cantidad debe ser al menos 1.'}, status=status.HTTP_400_BAD_REQUEST)
        if not motivo:
            return Response({'error': 'Indica el motivo de la devolución.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            detalle = DetalleVenta.objects.select_related('venta', 'producto').get(pk=detalle_id)
        except DetalleVenta.DoesNotExist:
            return Response({'error': 'El ítem de la venta no existe.'}, status=status.HTTP_404_NOT_FOUND)

        venta = detalle.venta

        # (1) Ítem ya procesado: aplica tanto para aprobar como para rechazar.
        # Contamos aprobadas Y rechazadas: una rechazada cierra la decisión de
        # esas unidades, no se puede reintentar.
        ya = Devolucion.objects.filter(
            detalle_id=detalle.id,
            estado__in=['aprobada', 'rechazada'],
        ).aggregate(t=Sum('cantidad'))['t'] or 0
        disponible = detalle.cantidad - ya
        if disponible <= 0:
            return Response(
                {'error': 'Este ítem ya fue procesado (aprobado o rechazado). No se puede volver a solicitar devolución.'},
                status=status.HTTP_400_BAD_REQUEST)
        if cantidad > disponible:
            return Response(
                {'error': f'Solo quedan {disponible} unidad(es) por devolver de este ítem.'},
                status=status.HTTP_400_BAD_REQUEST)

        if aprobar:
            # (2) Plazo <= 7 días desde la venta (solo para aprobar). Se compara por FECHA
            # (día) para evitar el choque naive/aware entre fecha_venta y timezone.now().
            if venta.fecha_venta and (timezone.now().date() - venta.fecha_venta.date()).days > self.DIAS_DEVOLUCION:
                return Response(
                    {'error': f'Fuera de plazo: la venta tiene más de {self.DIAS_DEVOLUCION} días. Solo puedes rechazar.'},
                    status=status.HTTP_400_BAD_REQUEST)
        else:
            if not motivo_rechazo:
                return Response({'error': 'Indica el motivo del rechazo.'}, status=status.HTTP_400_BAD_REQUEST)

        estado = 'aprobada' if aprobar else 'rechazada'
        monto  = round(float(detalle.precio_unitario) * cantidad, 2) if aprobar else 0

        actor = actor_from_request(request)
        # El registrador debe ser un usuario interno (no un cliente) para no romper la FK
        usuario_id = actor.get('usuario_id') if actor.get('usuario_rol') in ('admin', 'vendedor') else None

        try:
            dev = Devolucion.objects.create(
                venta_id=venta.id, detalle_id=detalle.id, producto_id=detalle.producto_id,
                cliente_id=venta.cliente_id, cantidad=cantidad, motivo=motivo,
                estado=estado, motivo_rechazo=motivo_rechazo, monto_reembolso=monto,
                usuario_id=usuario_id,
                insp_sin_dano=insp_sin_dano, insp_sin_manipulacion=insp_sin_manipulacion,
                insp_mismo_producto=insp_mismo_producto, insp_completo=insp_completo,
            )
            # Anulación de garantía:
            # - Al APROBAR: siempre (el producto vuelve a la tienda).
            # - Al RECHAZAR: solo si la inspección detectó daño o manipulación
            #   (el cliente rompió/abrió el producto → no tiene derecho a garantía).
            #   Los otros motivos de rechazo (no es el mismo producto, incompleto,
            #   fuera de plazo) NO anulan la garantía.
            anular_garantia = False
            resolucion_garantia = None
            if aprobar:
                anular_garantia = True
                resolucion_garantia = f'Garantía anulada por devolución aprobada (RMA-{timezone.now().year}-{dev.id:06d}).'
            else:
                if not insp_sin_dano and not insp_sin_manipulacion:
                    anular_garantia = True
                    resolucion_garantia = 'Garantía anulada por daño y manipulación detectados en la inspección física.'
                elif not insp_sin_dano:
                    anular_garantia = True
                    resolucion_garantia = 'Garantía anulada por daño detectado en la inspección física.'
                elif not insp_sin_manipulacion:
                    anular_garantia = True
                    resolucion_garantia = 'Garantía anulada por manipulación detectada en la inspección física.'
            if anular_garantia:
                Garantia.objects.filter(detalle_id=detalle.id).exclude(estado='anulada').update(
                    estado='anulada', resolucion=resolucion_garantia,
                    fecha_resolucion=timezone.now(),
                )
        except Exception as e:
            return Response({'error': f'No se pudo registrar la devolución: {e}'},
                            status=status.HTTP_400_BAD_REQUEST)

        prod = detalle.producto.nombre if detalle.producto else 'producto'
        try:
            log_action(
                accion='UPDATE', modulo='Devolución',
                descripcion=(f'Devolución {estado} de "{prod}" (x{cantidad}) de la venta #{venta.id}'
                             + (f' — reembolso Bs {monto:.2f}' if aprobar else f' — rechazo: {motivo_rechazo}')),
                **actor,
            )
        except Exception:
            pass  # la bitácora no debe tumbar la operación

        # CU23: avisar al cliente el resultado de la devolución (campana + correo).
        # Sigue el mismo patrón que garantías/reseñas; si falla no rompe el request.
        # Número de comprobante correlativo derivado del id: RMA-YYYY-000042
        # (simulacro por ahora; cuando se agregue transferencia bancaria en el
        # futuro, incluir cliente.cuenta_bancaria dentro del bloque "Detalles"
        # del correo aprobada — no requiere rediseñar el template).
        try:
            cli = venta.cliente
            if cli and getattr(cli, 'correo', ''):
                from django.conf import settings as _s
                from apps.users.views import crear_notificacion, _email_html
                from django.utils import timezone as _tz
                cli_nombre = f'{cli.nombre or ""} {cli.apellido or ""}'.strip() or 'cliente'
                nro_comprobante = f'RMA-{_tz.now().year}-{dev.id:06d}'
                if aprobar:
                    cuerpo = (
                        f'<p>Revisamos tu solicitud de devolución del <strong>{prod}</strong> '
                        f'(venta #{venta.id}) y el resultado es: <strong>APROBADA ✅</strong>.</p>'
                        f'<p style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;'
                        f'padding:10px 14px;margin:16px 0;font-size:13px;">'
                        f'📄 <strong>Comprobante N°:</strong> {nro_comprobante}</p>'
                        f'<p><strong>Detalles del reembolso:</strong></p>'
                        f'<ul style="margin:6px 0 14px 20px;padding:0;">'
                        f'<li>Cantidad: {cantidad} unidad(es)</li>'
                        f'<li>Monto: Bs {monto:.2f}</li>'
                        f'<li>Método: en efectivo, en tienda</li>'
                        f'</ul>'
                        f'<p>Presenta este comprobante junto con tu factura de compra '
                        f'al retirar el reembolso.</p>'
                        f'<p>Gracias por tu confianza.</p>'
                    )
                    titulo_notif = 'Tu solicitud de devolución fue aprobada'
                    mensaje_notif = (f'Devolución del {prod} (venta #{venta.id}): APROBADA ✅ '
                                     f'— Reembolso Bs {monto:.2f}. Comprobante {nro_comprobante}.')
                else:
                    motivo_txt = motivo_rechazo or 'no se indicó motivo específico'
                    cuerpo = (
                        f'<p>Revisamos tu solicitud de devolución del <strong>{prod}</strong> '
                        f'(venta #{venta.id}) y el resultado es: <strong>RECHAZADA</strong>.</p>'
                        f'<p style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;'
                        f'padding:10px 14px;margin:16px 0;font-size:13px;">'
                        f'📄 <strong>Comprobante N°:</strong> {nro_comprobante}</p>'
                        f'<p><strong>Motivo del rechazo:</strong><br/>{motivo_txt}</p>'
                        f'<p>Si tenés dudas o creés que hubo un error, podés acercarte a la tienda '
                        f'para conversar con nuestro equipo.</p>'
                    )
                    titulo_notif = 'Tu solicitud de devolución fue rechazada'
                    mensaje_notif = (f'Devolución del {prod} (venta #{venta.id}): RECHAZADA '
                                     f'— Motivo: {motivo_txt}. Comprobante {nro_comprobante}.')

                _html = _email_html(
                    cli_nombre, cuerpo,
                    'Ver mis pedidos', f'{_s.FRONTEND_URL}/orders',
                )
                crear_notificacion(
                    tipo='devolucion_resuelta',
                    titulo=titulo_notif,
                    mensaje=mensaje_notif,
                    cliente_id=venta.cliente_id, enlace='/orders',
                    canal='ambos', email=cli.correo, html=_html,
                )
        except Exception:
            pass  # el aviso al cliente no debe tumbar la operación

        return Response(DevolucionSerializer(dev).data, status=status.HTTP_201_CREATED)


# ── Servicio Técnico (CU25/26/27) ────────────────────────────────────────────
class ServicioCatalogoViewSet(viewsets.ReadOnlyModelViewSet):
    """Catálogo de servicios técnicos (solo lectura, para el formulario del técnico)."""
    queryset           = ServicioCatalogo.objects.filter(activo=True)
    serializer_class   = ServicioCatalogoSerializer
    permission_classes = [IsAuthenticatedJWT]
    filter_backends    = []


TAREAS_PREVENTIVO = [
    'Limpieza de polvo en ventiladores y disipadores',
    'Limpieza de puertos',
    'Cambio de pasta térmica',
    'Actualización de SO y antivirus',
    'Eliminación de archivos temporales',
    'Desfragmentación del disco',
]

# El preventivo gratis es SOLO para laptops → se detecta por el nombre de la categoría
_LAPTOP_KEYWORDS = ('laptop', 'notebook', 'portátil', 'portatil')

def _es_categoria_laptop(nombre):
    n = (nombre or '').lower()
    return any(k in n for k in _LAPTOP_KEYWORDS)


class OrdenServicioViewSet(viewsets.ModelViewSet):
    """
    Órdenes de servicio técnico (CU25/26/27). Las registra y ejecuta el técnico.
      GET   /ordenes-servicio/                         → lista (filtra por tecnico/cliente/estado)
      POST  /ordenes-servicio/                         → registrar (preventivo o correctivo)
      GET   /ordenes-servicio/elegibilidad/?cliente=   → garantías vigentes + usos gratis
      PATCH /ordenes-servicio/{id}/estado/             → cambiar estado / diagnóstico
      PATCH /ordenes-servicio/{id}/checklist/          → marcar tareas
    """
    queryset           = OrdenServicio.objects.select_related('cliente', 'tecnico', 'garantia').prefetch_related('detalles__servicio', 'tareas')
    serializer_class   = OrdenServicioSerializer
    permission_classes = [IsAuthenticatedJWT]
    http_method_names  = ['get', 'post', 'patch', 'head', 'options']
    filter_backends    = [OrderingFilter]
    ordering_fields    = ['id', 'fecha_solicitud']
    ordering           = ['-id']

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        # Un cliente logueado SOLO puede ver sus propias órdenes.
        # Sin esto, /ordenes-servicio/ devuelve todo el sistema y en la
        # pantalla "Mis Servicios" el cliente ve órdenes de otros clientes.
        auth = getattr(self.request, 'auth', None) or {}
        if auth.get('role') == 'cliente':
            qs = qs.filter(cliente_id=auth.get('user_id'))
        if p.get('tecnico'):
            qs = qs.filter(tecnico_id=p['tecnico'])
        if p.get('cliente'):
            qs = qs.filter(cliente_id=p['cliente'])
        if p.get('estado'):
            qs = qs.filter(estado=p['estado'])
        return qs

    def _preventivo_gratis_disponible(self, garantia_id):
        from django.utils import timezone
        try:
            g = Garantia.objects.get(pk=garantia_id)
        except Garantia.DoesNotExist:
            return False
        if g.fecha_fin < timezone.localdate():
            return False
        # El preventivo gratis es solo para laptops
        cat = g.producto.categoria.nombre if (g.producto and g.producto.categoria) else ''
        if not _es_categoria_laptop(cat):
            return False
        usos = OrdenServicio.objects.filter(garantia_id=garantia_id, es_beneficio=True)
        if usos.count() >= 2:
            return False
        ultimo = usos.order_by('-fecha_solicitud').first()
        if ultimo and ultimo.fecha_solicitud and (timezone.now().date() - ultimo.fecha_solicitud.date()).days < 180:
            return False
        return True

    @action(detail=False, methods=['get'])
    def elegibilidad(self, request):
        """Garantías vigentes del cliente + usos preventivos gratis disponibles."""
        from django.utils import timezone
        cliente_id = request.query_params.get('cliente')
        if not cliente_id:
            return Response([])
        hoy = timezone.localdate()
        gs = (Garantia.objects
              .select_related('producto', 'producto__categoria')
              .filter(cliente_id=cliente_id, fecha_fin__gte=hoy))
        out = []
        for g in gs:
            # Solo laptops tienen preventivo gratis
            cat = g.producto.categoria.nombre if (g.producto and g.producto.categoria) else ''
            if not _es_categoria_laptop(cat):
                continue
            usados = OrdenServicio.objects.filter(garantia_id=g.id, es_beneficio=True).count()
            out.append({
                'garantia_id': g.id,
                'producto': g.producto.nombre if g.producto else '—',
                'fecha_fin': g.fecha_fin,
                'usos_disponibles': max(0, 2 - usados),
            })
        return Response(out)

    @action(detail=False, methods=['get'], url_path='productos-cliente')
    def productos_cliente(self, request):
        """
        Equipos que el cliente compró en la tienda, filtrables por tipo (laptop
        o escritorio). Se usa en el wizard "Registrar servicio" cuando el
        técnico responde "Sí, es de tienda". Devuelve, para cada producto:
          · id del producto (para vincular via producto_referencia)
          · id de la garantía (para el beneficio GRATIS si aplica)
          · si la garantía está vigente
          · cuántos usos GRATIS le quedan (solo laptop + preventivo)
        Params: ?cliente=<id> [&equipo=laptop|escritorio]
        """
        from django.utils import timezone
        cliente_id = request.query_params.get('cliente')
        equipo     = (request.query_params.get('equipo') or 'laptop').lower()
        if not cliente_id:
            return Response([])
        hoy = timezone.localdate()
        gs = (Garantia.objects
              .select_related('producto', 'producto__categoria')
              .filter(cliente_id=cliente_id))
        out = []
        for g in gs:
            if not g.producto:
                continue
            cat = g.producto.categoria.nombre if g.producto.categoria else ''
            es_laptop = _es_categoria_laptop(cat)
            # Filtro por tipo del equipo elegido en el paso 3
            if equipo == 'laptop' and not es_laptop:
                continue
            if equipo == 'escritorio' and es_laptop:
                continue
            vigente = g.fecha_fin >= hoy
            usos_disponibles = 0
            if vigente and equipo == 'laptop':
                usados = OrdenServicio.objects.filter(garantia_id=g.id, es_beneficio=True).count()
                usos_disponibles = max(0, 2 - usados)
            out.append({
                'garantia_id':      g.id,
                'producto_id':      g.producto_id,
                'producto':         g.producto.nombre,
                'marca':            g.producto.marca,
                'modelo':           g.producto.modelo,
                'fecha_fin':        g.fecha_fin,
                'garantia_vigente': vigente,
                'usos_disponibles': usos_disponibles,
            })
        return Response(out)

    def create(self, request, *args, **kwargs):
        from django.utils import timezone
        from datetime import date as _date
        tipo   = request.data.get('tipo')
        origen = request.data.get('origen') or 'externo'
        equipo = request.data.get('equipo') or 'laptop'
        equipo_desc = (request.data.get('equipo_descripcion') or '').strip() or None
        cliente_id  = request.data.get('cliente') or None
        garantia_id = request.data.get('garantia') or None
        producto_ref_id = request.data.get('producto_referencia') or None
        servicios_ids = request.data.get('servicios') or []
        fecha_raw = request.data.get('fecha_entrega_prevista')

        if tipo not in ('preventivo', 'correctivo'):
            return Response({'error': 'Tipo de servicio inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validar que el producto de referencia exista si viene en el payload
        if producto_ref_id:
            if not Producto.objects.filter(pk=producto_ref_id).exists():
                return Response({'error': 'El producto de referencia no existe.'},
                                status=status.HTTP_400_BAD_REQUEST)

        # Fecha de retiro obligatoria — la orden nace directamente 'agendado'
        if not fecha_raw:
            return Response({'error': 'La fecha de retiro es obligatoria.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            fecha_entrega = _date.fromisoformat(str(fecha_raw)[:10])
        except ValueError:
            return Response({'error': 'Formato de fecha inválido (usar YYYY-MM-DD).'}, status=status.HTTP_400_BAD_REQUEST)
        if fecha_entrega < timezone.localdate():
            return Response({'error': 'La fecha de retiro no puede ser en el pasado.'}, status=status.HTTP_400_BAD_REQUEST)

        es_beneficio = False
        costo = 0.0
        detalles = []   # (servicio_id, precio)

        if tipo == 'preventivo':
            serv = ServicioCatalogo.objects.filter(tipo='preventivo', equipo=equipo, activo=True).first()
            if not serv:
                return Response({'error': f'No hay servicio preventivo para "{equipo}".'}, status=status.HTTP_400_BAD_REQUEST)
            precio = float(serv.precio)
            if origen == 'tienda' and equipo == 'laptop' and garantia_id and self._preventivo_gratis_disponible(garantia_id):
                es_beneficio = True
                precio = 0.0
            costo = precio
            detalles.append((serv.id, precio))
        else:  # correctivo
            if not servicios_ids:
                return Response({'error': 'Elige al menos un servicio correctivo.'}, status=status.HTTP_400_BAD_REQUEST)
            servs = ServicioCatalogo.objects.filter(id__in=servicios_ids, tipo='correctivo', activo=True)
            for s in servs:
                detalles.append((s.id, float(s.precio)))
                costo += float(s.precio)
            if not detalles:
                return Response({'error': 'Servicios inválidos.'}, status=status.HTTP_400_BAD_REQUEST)

        actor = actor_from_request(request)
        tecnico_id = actor.get('usuario_id') if actor.get('usuario_rol') in ('admin', 'vendedor', 'tecnico') else None

        try:
            orden = OrdenServicio.objects.create(
                cliente_id=cliente_id or None, tecnico_id=tecnico_id,
                garantia_id=(garantia_id if es_beneficio else None),
                producto_referencia_id=producto_ref_id or None,
                tipo=tipo, origen=origen, equipo=equipo, equipo_descripcion=equipo_desc,
                es_beneficio=es_beneficio, costo_total=round(costo, 2), estado='agendado',
                fecha_entrega_prevista=fecha_entrega, fecha_agendada=timezone.now(),
            )
            for (sid, precio) in detalles:
                OrdenDetalle.objects.create(orden_id=orden.id, servicio_id=sid, precio=round(precio, 2))
            if tipo == 'preventivo':
                for t in TAREAS_PREVENTIVO:
                    TareaServicio.objects.create(orden_id=orden.id, tarea=t, realizado=False)
        except Exception as e:
            return Response({'error': f'No se pudo registrar la orden: {e}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            gratis = ' (GRATIS - beneficio)' if es_beneficio else ''
            log_action(
                accion='CREATE', modulo='Servicio Técnico',
                descripcion=(f'Se registró la orden de servicio #{orden.id} — {tipo} ({equipo}), '
                             f'retiro {fecha_entrega.isoformat()}, costo Bs {orden.costo_total}{gratis}'),
                **actor,
            )
        except Exception:
            pass
        # Correo + campana al cliente con la fecha (si tiene correo registrado)
        if orden.cliente_id:
            self._notificar_agendada(orden, es_reagenda=False)
        return Response(OrdenServicioSerializer(orden).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'])
    def estado(self, request, pk=None):
        from django.utils import timezone
        orden = self.get_object()
        nuevo = request.data.get('estado')
        if nuevo not in ('solicitado', 'agendado', 'en_proceso', 'finalizado', 'entregado', 'cancelado'):
            return Response({'error': 'Estado inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        orden.estado = nuevo
        fields = ['estado']
        if nuevo == 'finalizado':
            orden.fecha_finalizacion = timezone.now()
            fields.append('fecha_finalizacion')
        if nuevo == 'entregado':
            orden.fecha_entrega_real = timezone.now()
            fields.append('fecha_entrega_real')
        if request.data.get('fecha_agendada'):
            orden.fecha_agendada = request.data.get('fecha_agendada')
            fields.append('fecha_agendada')
        if 'diagnostico' in request.data:
            orden.diagnostico = request.data.get('diagnostico')
            fields.append('diagnostico')
        if 'observaciones' in request.data:
            orden.observaciones = request.data.get('observaciones')
            fields.append('observaciones')
        orden.save(update_fields=fields)
        actor = actor_from_request(request)
        try:
            log_action(accion='UPDATE', modulo='Servicio Técnico',
                       descripcion=f'Orden de servicio #{orden.id} → {nuevo}', **actor)
        except Exception:
            pass
        # CU21: al finalizar, avisar al cliente con texto adaptativo según la
        # fecha real vs la fecha_entrega_prevista (adelantado, en fecha, retrasado).
        if nuevo == 'finalizado' and orden.cliente_id:
            self._notificar_finalizacion(orden)
        orden.refresh_from_db()
        return Response(OrdenServicioSerializer(orden).data)

    @action(detail=True, methods=['patch'])
    def agendar(self, request, pk=None):
        """
        Agenda una orden fijando la fecha de retiro prevista. Envía correo +
        campana al cliente con la fecha comprometida. Puede reagendar (pasar
        de agendado a agendado con otra fecha).
        """
        from django.utils import timezone
        from datetime import date as _date, datetime as _dt
        orden = self.get_object()
        fecha_raw = request.data.get('fecha_entrega_prevista')
        if not fecha_raw:
            return Response({'error': 'Debes indicar la fecha de retiro.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            fecha = _date.fromisoformat(str(fecha_raw)[:10])
        except ValueError:
            return Response({'error': 'Formato de fecha inválido (usar YYYY-MM-DD).'},
                            status=status.HTTP_400_BAD_REQUEST)
        if fecha < timezone.localdate():
            return Response({'error': 'La fecha de retiro no puede ser en el pasado.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if orden.estado in ('finalizado', 'entregado', 'cancelado'):
            return Response({'error': f'No se puede agendar una orden en estado "{orden.estado}".'},
                            status=status.HTTP_400_BAD_REQUEST)
        es_reagenda = orden.estado == 'agendado' and orden.fecha_entrega_prevista != fecha
        orden.fecha_entrega_prevista = fecha
        orden.fecha_agendada = timezone.now()
        orden.estado = 'agendado'
        orden.save(update_fields=['fecha_entrega_prevista', 'fecha_agendada', 'estado'])
        actor = actor_from_request(request)
        try:
            log_action(
                accion='UPDATE', modulo='Servicio Técnico',
                descripcion=(f'Orden #{orden.id} '
                             + ('reagendada' if es_reagenda else 'agendada')
                             + f' — retiro previsto {fecha.isoformat()}'),
                **actor,
            )
        except Exception:
            pass
        # Correo + campana al cliente con la fecha
        if orden.cliente_id:
            self._notificar_agendada(orden, es_reagenda=es_reagenda)
        orden.refresh_from_db()
        return Response(OrdenServicioSerializer(orden).data)

    @action(detail=True, methods=['patch'])
    def entregar(self, request, pk=None):
        """
        Marca la orden como entregada al cliente. Solo se puede desde 'finalizado'.
        NO envía correo (el cliente está en la tienda al retirar).
        """
        from django.utils import timezone
        orden = self.get_object()
        if orden.estado != 'finalizado':
            return Response({'error': 'Solo se puede entregar una orden finalizada.'},
                            status=status.HTTP_400_BAD_REQUEST)
        orden.estado = 'entregado'
        orden.fecha_entrega_real = timezone.now()
        orden.save(update_fields=['estado', 'fecha_entrega_real'])
        actor = actor_from_request(request)
        try:
            log_action(
                accion='UPDATE', modulo='Servicio Técnico',
                descripcion=f'Orden #{orden.id} entregada al cliente',
                **actor,
            )
        except Exception:
            pass
        orden.refresh_from_db()
        return Response(OrdenServicioSerializer(orden).data)

    def _notificar_agendada(self, orden, es_reagenda=False):
        """Correo + campana al cliente con la fecha de retiro programada."""
        cli = orden.cliente
        if not (cli and getattr(cli, 'correo', '')):
            return
        try:
            from django.conf import settings as _s
            from apps.users.views import crear_notificacion, _email_html
            nombre = f'{cli.nombre or ""} {cli.apellido or ""}'.strip() or 'cliente'
            fecha_str = orden.fecha_entrega_prevista.strftime('%d/%m/%Y') if orden.fecha_entrega_prevista else '—'
            tipo_str = 'MANTENIMIENTO PREVENTIVO' if orden.tipo == 'preventivo' else 'SERVICIO CORRECTIVO'
            costo_txt = 'GRATIS (beneficio de garantía)' if orden.es_beneficio else f'Bs {float(orden.costo_total):.2f}'
            intro = ('Actualizamos la fecha de retiro de tu equipo:'
                     if es_reagenda else
                     f'Recibimos tu equipo y programamos el servicio de <strong>{tipo_str}</strong> ({orden.equipo}).')
            cuerpo = (
                f'<p>{intro}</p>'
                f'<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;'
                f'padding:14px;margin:16px 0;text-align:center;">'
                f'<p style="margin:0;font-size:12px;color:#3730a3;font-weight:bold;letter-spacing:1px;">📅 FECHA DE RETIRO</p>'
                f'<p style="margin:6px 0 0;font-size:20px;font-weight:bold;color:#1e40af;">{fecha_str}</p>'
                f'<p style="margin:4px 0 0;font-size:12px;color:#4b5563;">Horario: 09:00 – 18:00</p>'
                f'</div>'
                f'<p>📍 <strong>Ubicación:</strong> Av. Cristo Redentor #123, Santa Cruz de la Sierra</p>'
                f'<p>📄 <strong>Orden:</strong> #{orden.id}<br/>'
                f'💵 <strong>Costo:</strong> {costo_txt}</p>'
                f'<p>Vamos a dejar tu equipo impecable. Cuando esté listo antes de esa fecha te avisamos por este mismo medio.</p>'
            )
            _html = _email_html(nombre, cuerpo, 'Ver mi orden', f'{_s.FRONTEND_URL}/orders')
            asunto_prefix = 'Actualizamos' if es_reagenda else 'Tu equipo tiene'
            crear_notificacion(
                tipo='servicio',
                titulo=f'{asunto_prefix} fecha de retiro programada',
                mensaje=f'Orden #{orden.id} ({orden.tipo}, {orden.equipo}): retiro programado para el {fecha_str}.',
                cliente_id=orden.cliente_id, enlace='/orders',
                canal='ambos', email=cli.correo, html=_html,
            )
        except Exception:
            pass  # no rompe el request si el correo falla

    def _notificar_finalizacion(self, orden):
        """Correo + campana al cliente cuando el equipo queda listo (texto adaptativo)."""
        cli = orden.cliente
        if not (cli and getattr(cli, 'correo', '')):
            return
        try:
            from django.conf import settings as _s
            from django.utils import timezone as _tz
            from apps.users.views import crear_notificacion, _email_html
            nombre = f'{cli.nombre or ""} {cli.apellido or ""}'.strip() or 'cliente'
            costo_txt = 'GRATIS' if orden.es_beneficio else f'Bs {float(orden.costo_total):.2f}'
            hoy = _tz.localdate()
            prevista = orden.fecha_entrega_prevista
            # 3 escenarios según cuando se finalizó vs la fecha prevista
            if prevista and hoy < prevista:
                # Adelantado
                asunto  = '¡Buenas noticias! Tu equipo está listo antes de lo previsto'
                titular = 'Tu equipo está ✅ LISTO <strong>antes de lo previsto</strong>.'
                caja = (f'<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin:16px 0;">'
                        f'<p style="margin:0 0 6px;">📅 Fecha original de retiro: <strong>{prevista.strftime("%d/%m/%Y")}</strong></p>'
                        f'<p style="margin:0;color:#166534;font-weight:bold;">🎉 Podés retirarlo DESDE HOY (Horario: 09:00 – 18:00)</p>'
                        f'</div>')
                mensaje_camp = f'Orden #{orden.id} lista antes de lo previsto. Retirar desde hoy.'
            elif prevista and hoy > prevista:
                # Retrasado
                asunto  = 'Tu equipo ya está listo. Disculpá el retraso'
                titular = 'Tu equipo ya está ✅ LISTO. Disculpá el retraso respecto a la fecha original.'
                caja = (f'<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin:16px 0;">'
                        f'<p style="margin:0 0 6px;">📅 Fecha original de retiro: {prevista.strftime("%d/%m/%Y")}</p>'
                        f'<p style="margin:0;font-weight:bold;">🎯 Podés retirarlo DESDE HOY (Horario: 09:00 – 18:00)</p>'
                        f'</div>')
                mensaje_camp = f'Orden #{orden.id} lista (con retraso). Retirar desde hoy.'
            else:
                # En fecha (o sin fecha prevista)
                asunto  = 'Tu equipo está listo para retirar'
                titular = 'Como te habíamos dicho, tu equipo está ✅ LISTO para retirar HOY.'
                fecha_txt = f'📅 Fecha de retiro: {prevista.strftime("%d/%m/%Y")}<br/>' if prevista else ''
                caja = (f'<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin:16px 0;">'
                        f'<p style="margin:0;">{fecha_txt}Horario: 09:00 – 18:00</p>'
                        f'</div>')
                mensaje_camp = f'Orden #{orden.id} lista para retirar.'

            # Trabajos realizados (checklist marcado + servicios)
            tareas_ok = list(orden.tareas.filter(realizado=True).values_list('tarea', flat=True))
            servicios = list(orden.detalles.select_related('servicio').all())
            trabajos_html = ''
            if tareas_ok or servicios:
                items = ''.join(f'<li>{s.servicio.nombre if s.servicio else "servicio"}</li>' for s in servicios)
                items += ''.join(f'<li>{t}</li>' for t in tareas_ok)
                trabajos_html = (f'<p><strong>Trabajos realizados:</strong></p>'
                                 f'<ul style="margin:6px 0 14px 20px;padding:0;">{items}</ul>')

            cuerpo = (
                f'<p>{titular}</p>'
                f'{caja}'
                f'<p>📄 <strong>Orden:</strong> #{orden.id} · {orden.tipo.capitalize()} · {orden.equipo.capitalize()}<br/>'
                f'💵 <strong>Costo:</strong> {costo_txt}</p>'
                f'{trabajos_html}'
                f'<p>Cuando lo retires te vamos a pedir tu firma para cerrar la orden.</p>'
            )
            _html = _email_html(nombre, cuerpo, 'Ver mi orden', f'{_s.FRONTEND_URL}/orders')
            crear_notificacion(
                tipo='servicio', titulo=asunto,
                mensaje=mensaje_camp,
                cliente_id=orden.cliente_id, enlace='/orders',
                canal='ambos', email=cli.correo, html=_html,
            )
        except Exception:
            pass

    @action(detail=True, methods=['patch'])
    def checklist(self, request, pk=None):
        orden = self.get_object()
        for t in (request.data.get('tareas') or []):
            TareaServicio.objects.filter(id=t.get('id'), orden_id=orden.id).update(realizado=bool(t.get('realizado')))
        orden.refresh_from_db()
        return Response(OrdenServicioSerializer(orden).data)


# ── Venta a crédito / Cartera de créditos (CU28/CU29) ─────────────────────────
from decimal import Decimal, ROUND_HALF_UP

# Rangos de crédito POR PRODUCTO (según su precio UNITARIO):
#   (min, max, n_cuotas, recargo_pct)
CREDITO_RANGOS = [
    (Decimal('1'),      Decimal('5000'),  6,  Decimal('20')),
    (Decimal('5001'),   Decimal('10000'), 9,  Decimal('25')),
    (Decimal('10001'),  Decimal('15000'), 12, Decimal('30')),
]
CREDITO_INICIAL_PCT = Decimal('20')   # 20% del precio financiado
CREDITO_MORA_PCT    = Decimal('10')   # 10% de recargo sobre la cuota vencida


def _2d(x):
    """Redondea un Decimal a 2 decimales (bancario HALF_UP)."""
    return Decimal(x).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def _add_months(d, n):
    """Suma n meses a una fecha (ajustando el día si el mes es más corto)."""
    import calendar
    m = d.month - 1 + n
    y = d.year + m // 12
    m = m % 12 + 1
    day = min(d.day, calendar.monthrange(y, m)[1])
    return d.replace(year=y, month=m, day=day)


def calcular_credito(precio_unitario, cantidad):
    """
    Devuelve el plan calculado para un producto, o None si no califica.
    El rango se decide por el PRECIO UNITARIO; el financiamiento por el total.
    """
    pu = Decimal(str(precio_unitario or 0))
    cant = int(cantidad or 1)
    if cant < 1:
        cant = 1
    rango = next((r for r in CREDITO_RANGOS if r[0] <= pu <= r[1]), None)
    if not rango:
        return None
    _, _, n_cuotas, recargo_pct = rango
    precio_base       = _2d(pu * cant)
    precio_financiado = _2d(precio_base * (Decimal('1') + recargo_pct / Decimal('100')))
    inicial           = _2d(precio_financiado * CREDITO_INICIAL_PCT / Decimal('100'))
    saldo             = _2d(precio_financiado - inicial)
    monto_cuota       = _2d(saldo / Decimal(n_cuotas))
    # La última cuota absorbe el residuo del redondeo para que sumen exacto el saldo.
    montos = [monto_cuota] * n_cuotas
    montos[-1] = _2d(saldo - monto_cuota * (n_cuotas - 1))
    return {
        'precio_unitario': pu, 'cantidad': cant, 'precio_base': precio_base,
        'recargo_pct': recargo_pct, 'precio_financiado': precio_financiado,
        'inicial': inicial, 'n_cuotas': n_cuotas, 'monto_cuota': monto_cuota,
        'saldo': saldo, 'montos_cuotas': montos,
    }


def _siguiente_numero_factura_credito():
    """
    Devuelve el siguiente correlativo de factura del módulo crédito con formato
    FCR-{año}-{correlativo:06d}. La secuencia PostgreSQL `factura_credito_seq`
    garantiza unicidad global aunque haya varios inserts en paralelo.
    """
    from django.db import connection
    from django.utils import timezone
    with connection.cursor() as cur:
        cur.execute("SELECT nextval('factura_credito_seq')")
        n = cur.fetchone()[0]
    return f'FCR-{timezone.now().year}-{n:06d}'


# Datos fijos de la empresa que aparecen en las facturas HTML. Un cliente
# real los tendría en la BD; para el proyecto están hardcodeados y se usan
# tanto en la factura de la inicial como en la de cada cuota.
EMPRESA_FACTURA = {
    'nombre':    'Santa Cruz Computer',
    'nit':       '1234567019',
    'direccion': 'Av. Cristo Redentor #123, Santa Cruz de la Sierra, Bolivia',
    'telefono':  '+591 3 344 5566',
    'correo':    'ventas@santacruzcomputer.bo',
}


def _render_factura_credito(template_name, context):
    """
    Renderiza el HTML de una factura del módulo crédito. Encapsula la lógica
    de tomar `logo_url`, `frontend_url` y los datos de empresa de forma consistente,
    para que el walk-in y el cobro de cuotas usen los mismos defaults.
    """
    from django.conf import settings as _s
    from django.template.loader import render_to_string
    from django.utils import timezone
    ctx = {
        'logo_url':      f'{_s.FRONTEND_URL}/logo.png',
        'frontend_url':  _s.FRONTEND_URL,
        'fecha_emision': timezone.now(),
        'empresa':       EMPRESA_FACTURA,
    }
    ctx.update(context)
    return render_to_string(template_name, ctx)


def _notificar_cuota_pagada(cuota, stripe_receipt_url=None):
    """
    Envía la factura de la cuota al cliente por correo (Brevo) + campana.
    Se usa desde el cobro presencial en efectivo (PATCH /pagar-cuota/) y también
    desde el cobro Stripe (return-URL / verificar-pendiente). El template es
    el mismo (facturas/factura_cuota.html); solo cambia `stripe_receipt_url`
    cuando aplica.

    Espera que la cuota YA esté cerrada (estado='pagada', numero_factura seteado,
    saldo del plan actualizado). No modifica nada aquí.
    """
    plan = cuota.plan
    cliente = plan.cliente
    if not (cliente and getattr(cliente, 'correo', '')):
        return
    try:
        from apps.users.views import crear_notificacion
        cuotas_ordenadas = list(plan.cuotas.order_by('numero'))
        cuotas_pagadas = sum(1 for c in cuotas_ordenadas if c.estado == 'pagada')
        cuotas_restantes = plan.n_cuotas - cuotas_pagadas
        total_pagado = _2d(Decimal(str(cuota.monto)) + Decimal(str(cuota.mora)))
        producto = plan.producto
        html = _render_factura_credito('facturas/factura_cuota.html', {
            'cliente': {
                'nombre':   f'{cliente.nombre or ""} {cliente.apellido or ""}'.strip() or 'Cliente',
                'ci':       getattr(cliente, 'nit_ci', None),
                'correo':   cliente.correo,
                'telefono': getattr(cliente, 'telefono', None),
            },
            'plan':               plan,
            'producto_nombre':    producto.nombre if producto else '—',
            'cuota':              cuota,
            'cuotas':             cuotas_ordenadas,
            'cuotas_pagadas':     cuotas_pagadas,
            'cuotas_restantes':   cuotas_restantes,
            'total_pagado':       total_pagado,
            'saldo_restante':     plan.saldo,
            'stripe_receipt_url': stripe_receipt_url,
        })
        crear_notificacion(
            tipo='credito',
            titulo=f'Pago de cuota confirmado — {cuota.numero_factura or "sin factura"}',
            mensaje=(f'Cobramos la cuota {cuota.numero}/{plan.n_cuotas} de tu crédito '
                     f'({plan.numero_factura}) por Bs {float(total_pagado):.2f}.'),
            cliente_id=cliente.id, enlace='/mis-creditos',
            canal='ambos', email=cliente.correo, html=html,
        )
    except Exception:
        pass  # el fallo del correo no debe romper el request


def _refrescar_moras(plan):
    """
    Marca como 'vencida' las cuotas pendientes cuyo vencimiento ya pasó y les
    aplica el recargo de mora (10%) una sola vez. Ajusta el estado del plan.
    Se llama de forma perezosa al leer un plan / la cartera (no hay cron).
    """
    from django.utils import timezone
    hoy = timezone.localdate()
    hubo_vencida = False
    for c in plan.cuotas.all():
        if c.estado == 'pendiente' and c.fecha_vencimiento < hoy:
            c.estado = 'vencida'
            c.mora = _2d(Decimal(str(c.monto)) * CREDITO_MORA_PCT / Decimal('100'))
            c.save(update_fields=['estado', 'mora'])
            hubo_vencida = True
        elif c.estado == 'vencida':
            hubo_vencida = True
    nuevo_estado = 'moroso' if hubo_vencida else plan.estado
    # Si ya no hay cuotas pendientes/vencidas → pagado
    if all(c.estado == 'pagada' for c in plan.cuotas.all()) and plan.cuotas.exists():
        nuevo_estado = 'pagado'
    elif not hubo_vencida and plan.estado == 'moroso':
        nuevo_estado = 'vigente'
    if nuevo_estado != plan.estado:
        plan.estado = nuevo_estado
        plan.save(update_fields=['estado'])
    return plan


class PlanCreditoViewSet(viewsets.ModelViewSet):
    """
    Venta a crédito (CU28) + Cartera (CU29).

      GET   /planes-credito/                    → lista (filtra por cliente/estado)
      GET   /planes-credito/?cliente=<id>       → créditos de un cliente
      POST  /planes-credito/                    → crear plan sobre un detalle de venta
      GET   /planes-credito/simular/?precio=&cantidad=  → vista previa (sin guardar)
      GET   /planes-credito/bloqueo/?cliente=<id>       → ¿bloqueado por mora?
      PATCH /planes-credito/pagar-cuota/        → registrar el pago de una cuota
      GET   /planes-credito/cartera/            → resumen para el admin (CU29)
    """
    queryset           = PlanCredito.objects.select_related('cliente', 'producto', 'usuario').prefetch_related('cuotas')
    serializer_class   = PlanCreditoSerializer
    permission_classes = [IsAuthenticatedJWT]
    http_method_names  = ['get', 'post', 'patch', 'head', 'options']
    filter_backends    = [OrderingFilter]
    ordering_fields    = ['id', 'fecha']
    ordering           = ['-id']

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get('cliente'):
            qs = qs.filter(cliente_id=p['cliente'])
        if p.get('estado'):
            qs = qs.filter(estado=p['estado'])
        return qs

    def list(self, request, *args, **kwargs):
        # Refrescar moras de forma perezosa antes de responder
        for plan in self.filter_queryset(self.get_queryset()):
            _refrescar_moras(plan)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        plan = self.get_object()
        _refrescar_moras(plan)
        return Response(PlanCreditoSerializer(plan).data)

    @action(detail=False, methods=['get'])
    def simular(self, request):
        """Vista previa del plan (para el formulario, sin guardar nada)."""
        precio   = request.query_params.get('precio')
        cantidad = request.query_params.get('cantidad') or 1
        plan = calcular_credito(precio, cantidad)
        if not plan:
            return Response({'elegible': False,
                             'motivo': 'El precio unitario debe estar entre Bs 1 y Bs 15.000.'})
        return Response({'elegible': True, **{k: (str(v) if isinstance(v, Decimal) else v)
                                              for k, v in plan.items() if k != 'montos_cuotas'}})

    @action(detail=False, methods=['get'], url_path='mis-creditos')
    def mis_creditos(self, request):
        """
        Vista del CLIENTE: devuelve solo los planes de crédito del cliente
        logueado (según JWT). Trae cuotas, checklist, resumen y el próximo
        vencimiento para armar la pantalla `Mis Créditos`.

        401 si no hay JWT válido, 403 si el rol no es 'cliente' (los admins
        pueden usar /planes-credito/ estándar).
        """
        if not request.auth:
            return Response({'error': 'No autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)
        role = request.auth.get('role', '')
        if role != 'cliente':
            return Response({'error': 'Este endpoint es solo para clientes.'},
                            status=status.HTTP_403_FORBIDDEN)
        cliente_id = request.auth.get('user_id')

        # Refrescamos moras antes de responder (perezoso, sin cron)
        planes = list(PlanCredito.objects.filter(cliente_id=cliente_id)
                      .select_related('producto').prefetch_related('cuotas', 'checklist'))
        for p in planes:
            _refrescar_moras(p)

        # Resumen del cliente para la pantalla
        activos_qs = [p for p in planes if p.estado in ('vigente', 'moroso')]
        total_saldo = sum((Decimal(str(p.saldo)) for p in activos_qs), Decimal('0'))
        cuotas_pendientes = [
            c for p in activos_qs for c in p.cuotas.all()
            if c.estado in ('pendiente', 'vencida')
        ]
        cuotas_vencidas = [c for c in cuotas_pendientes if c.estado == 'vencida']
        proxima = min(cuotas_pendientes, key=lambda c: c.fecha_vencimiento, default=None)

        data = PlanCreditoSerializer(
            sorted(planes, key=lambda x: x.id, reverse=True), many=True).data
        return Response({
            'resumen': {
                'planes_activos':  len(activos_qs),
                'planes_pagados':  sum(1 for p in planes if p.estado == 'pagado'),
                'planes_totales':  len(planes),
                'saldo_pendiente': str(_2d(total_saldo)),
                'cuotas_pendientes': len(cuotas_pendientes),
                'cuotas_vencidas':   len(cuotas_vencidas),
                'proxima_cuota': ({
                    'plan_id':           proxima.plan_id,
                    'numero':            proxima.numero,
                    'monto':             str(proxima.monto),
                    'mora':              str(proxima.mora),
                    'fecha_vencimiento': proxima.fecha_vencimiento.isoformat(),
                    'estado':            proxima.estado,
                } if proxima else None),
            },
            'planes': data,
        })

    @action(detail=False, methods=['get'])
    def bloqueo(self, request):
        """¿El cliente está bloqueado para nuevos créditos? (tiene cuotas vencidas o llegó al tope)."""
        cliente_id = request.query_params.get('cliente')
        if not cliente_id:
            return Response({'bloqueado': False, 'cuotas_vencidas': 0, 'activos': 0, 'limite': 3})
        for plan in PlanCredito.objects.filter(cliente_id=cliente_id).prefetch_related('cuotas'):
            _refrescar_moras(plan)
        venc = Cuota.objects.filter(plan__cliente_id=cliente_id, estado='vencida').count()
        activos = PlanCredito.objects.filter(cliente_id=cliente_id, estado__in=['vigente', 'moroso']).count()
        return Response({
            'bloqueado': venc > 0 or activos >= 3,
            'cuotas_vencidas': venc,
            'activos': activos,
            'limite': 3,
            'motivo': ('mora'         if venc > 0 else
                       'limite'       if activos >= 3 else
                       'advertencia'  if activos == 2 else
                       None),
        })

    def _crear_credito_atomico(self, request, origen):
        """
        Lógica compartida entre walk-in y desde-venta. Crea de forma atómica:
        venta + detalle + pago inicial + plan + checklist + N cuotas +
        numero_factura, y notifica al cliente por correo/campana.

        `origen` debe ser 'walk_in' o 'al_credito_sales'. Cambia el campo
        `plan_credito.origen` y el texto de bitácora, pero el flujo es idéntico.

        Devuelve un rest_framework.Response con el payload del plan (201) o el
        error (400/404). Nunca lanza excepción hacia arriba.
        """
        from django.db import transaction
        from django.utils import timezone

        cliente_id       = request.data.get('cliente')
        producto_id      = request.data.get('producto')
        cantidad         = int(request.data.get('cantidad') or 1)
        tipo_empleo      = (request.data.get('tipo_empleo') or '').strip()
        antiguedad_meses = int(request.data.get('antiguedad_meses') or 0)
        observaciones    = (request.data.get('observaciones') or '').strip() or None
        checklist        = request.data.get('checklist') or {}

        # ---- Validaciones básicas ------------------------------------------------
        if not cliente_id:
            return Response({'error': 'Cliente obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)
        if not producto_id:
            return Response({'error': 'Producto obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)
        if cantidad < 1:
            return Response({'error': 'La cantidad debe ser al menos 1.'}, status=status.HTTP_400_BAD_REQUEST)
        if tipo_empleo not in ('dependiente', 'independiente'):
            return Response({'error': 'tipo_empleo debe ser "dependiente" o "independiente".'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Cliente existe
        try:
            cliente = Cliente.objects.get(pk=cliente_id)
        except Cliente.DoesNotExist:
            return Response({'error': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        # Producto existe con stock suficiente
        try:
            producto = Producto.objects.get(pk=producto_id)
        except Producto.DoesNotExist:
            return Response({'error': 'Producto no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        if int(getattr(producto, 'stock_fisico', 0) or 0) < cantidad:
            return Response({'error': 'Stock insuficiente para armar el crédito.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # No bloqueado por mora ni por límite de créditos activos
        for plan in PlanCredito.objects.filter(cliente_id=cliente.id).prefetch_related('cuotas'):
            _refrescar_moras(plan)
        venc = Cuota.objects.filter(plan__cliente_id=cliente.id, estado='vencida').count()
        if venc > 0:
            return Response({'error': f'El cliente tiene {venc} cuota(s) vencida(s). Regularizar antes de otorgar nuevos créditos.'},
                            status=status.HTTP_400_BAD_REQUEST)
        activos = PlanCredito.objects.filter(cliente_id=cliente.id, estado__in=['vigente', 'moroso']).count()
        if activos >= 3:
            return Response({'error': f'El cliente ya tiene {activos} créditos activos (máximo 3). Esperar a que cancele alguno.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # El precio unitario del producto tiene que caer en el rango habilitado
        pu = Decimal(str(producto.precio_actual or 0))
        calc = calcular_credito(pu, cantidad)
        if not calc:
            return Response({'error': 'El producto no califica a crédito (precio unitario fuera de Bs 1–15.000).'},
                            status=status.HTTP_400_BAD_REQUEST)

        # ---- Actor + creación atómica -------------------------------------------
        actor = actor_from_request(request)
        usuario_id = actor.get('usuario_id') if actor.get('usuario_rol') in ('admin', 'vendedor') else None

        try:
            with transaction.atomic():
                # 1) Venta cabecera — presencial (pedido_online=False)
                venta = Venta.objects.create(
                    cliente_id=cliente.id, usuario_id=usuario_id,
                    pedido_online=False, descuento_aplicado=0,
                )
                # 2) Detalle — los triggers descuentan stock y actualizan monto_total
                detalle = DetalleVenta.objects.create(
                    venta_id=venta.id, producto_id=producto.id,
                    cantidad=cantidad, precio_unitario=pu,
                )
                # 3) Pago inicial en efectivo
                PagoVenta.objects.create(
                    venta_id=venta.id, monto=calc['inicial'], metodo='efectivo',
                )
                # 4) Como el producto SE ENTREGA al firmar el crédito, forzamos
                #    completed/entregado — el resto se cobra por cuotas (tabla cuota),
                #    no por más PagoVenta.
                Venta.objects.filter(pk=venta.id).update(estado='completed', estado_entrega='entregado')

                # 5) Número de factura para la inicial
                nro_factura = _siguiente_numero_factura_credito()

                # 6) Plan de crédito
                plan = PlanCredito.objects.create(
                    venta_id=venta.id, detalle_id=detalle.id, producto_id=producto.id,
                    cliente_id=cliente.id, usuario_id=usuario_id,
                    precio_unitario=calc['precio_unitario'], cantidad=calc['cantidad'],
                    precio_base=calc['precio_base'], recargo_pct=calc['recargo_pct'],
                    precio_financiado=calc['precio_financiado'], inicial=calc['inicial'],
                    n_cuotas=calc['n_cuotas'], monto_cuota=calc['monto_cuota'],
                    saldo=calc['saldo'], estado='vigente',
                    origen=origen, numero_factura=nro_factura,
                )
                # 7) Checklist
                ChecklistCredito.objects.create(
                    plan_id=plan.id,
                    tipo_empleo=tipo_empleo, antiguedad_meses=antiguedad_meses,
                    ci_solicitante         = bool(checklist.get('ci_solicitante')),
                    ci_conyuge             = bool(checklist.get('ci_conyuge')),
                    factura_servicios      = bool(checklist.get('factura_servicios')),
                    boletas_pago           = bool(checklist.get('boletas_pago')),
                    extracto_gestora       = bool(checklist.get('extracto_gestora')),
                    facturas_ultimo_ano    = bool(checklist.get('facturas_ultimo_ano')),
                    estados_financieros    = bool(checklist.get('estados_financieros')),
                    nit                    = bool(checklist.get('nit')),
                    croquis_domicilio      = bool(checklist.get('croquis_domicilio')),
                    croquis_negocio        = bool(checklist.get('croquis_negocio')),
                    respaldos_patrimoniales= bool(checklist.get('respaldos_patrimoniales')),
                    observaciones          = observaciones,
                )
                # 8) Cuotas
                hoy = timezone.localdate()
                for i, monto in enumerate(calc['montos_cuotas'], start=1):
                    Cuota.objects.create(
                        plan_id=plan.id, numero=i, monto=monto, mora=0,
                        fecha_vencimiento=_add_months(hoy, i), estado='pendiente',
                    )
        except Exception as e:
            return Response({'error': f'No se pudo crear el crédito: {e}'},
                            status=status.HTTP_400_BAD_REQUEST)

        # ---- Post-transacción: bitácora + notificación al cliente ---------------
        origen_lbl = 'walk-in' if origen == 'walk_in' else 'desde Sales'
        try:
            log_action(
                accion='CREATE', modulo='Crédito',
                descripcion=(f'Crédito {origen_lbl} #{plan.id} — {producto.nombre} '
                             f'({plan.n_cuotas} cuotas +{plan.recargo_pct}%), '
                             f'inicial Bs {plan.inicial} efectivo, factura {nro_factura}'),
                **actor,
            )
        except Exception:
            pass

        self._notificar_credito_creado(plan, producto, cliente)

        plan.refresh_from_db()
        payload = PlanCreditoSerializer(plan).data
        # Advertencia: si ahora quedó con 3 activos, el próximo estará bloqueado
        payload['advertencia'] = ('Con este crédito el cliente llega al tope de 3 créditos activos. '
                                  'El próximo será rechazado.') if (activos + 1) >= 3 else None
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='walk-in')
    def walk_in(self, request):
        """
        Crea un crédito walk-in de forma atómica (venta + detalle + pago inicial +
        plan + checklist + cuotas + numero_factura). Se usa desde /creditos cuando
        el cliente viene físicamente y no hay una venta previa en curso.

        Body:
          {
            "cliente":            123,
            "producto":           45,
            "cantidad":           1,        # opcional, default 1
            "tipo_empleo":        "dependiente" | "independiente",
            "antiguedad_meses":   24,
            "observaciones":      "…",      # opcional
            "checklist": { ...booleans según tipo_empleo... }
          }
        """
        return self._crear_credito_atomico(request, origen='walk_in')

    @action(detail=False, methods=['post'], url_path='desde-venta')
    def desde_venta(self, request):
        """
        Crea el crédito atómico cuando el vendedor elige el método de pago
        "Al crédito" en /sales. Recibe exactamente el mismo body que walk-in
        y el flujo es idéntico — la única diferencia es que `origen` se guarda
        como 'al_credito_sales' para trazabilidad.

        (Antes del refactor este flujo era: crear venta al contado y después
        "convertirla" en crédito. Ahora se hace todo de una para no dejar
        estados intermedios inconsistentes si el vendedor abandona a mitad.)
        """
        return self._crear_credito_atomico(request, origen='al_credito_sales')

    def _notificar_credito_creado(self, plan, producto, cliente):
        """
        Correo (con la factura HTML renderizada) + campana al cliente cuando
        se le aprueba un crédito walk-in.
        """
        if not (cliente and getattr(cliente, 'correo', '')):
            return
        try:
            from apps.users.views import crear_notificacion
            # Recargo monetario = financiado - base (para no re-calcularlo en el template)
            recargo_monto = _2d(Decimal(str(plan.precio_financiado)) - Decimal(str(plan.precio_base)))
            html = _render_factura_credito('facturas/factura_inicial.html', {
                'cliente': {
                    'nombre':   f'{cliente.nombre or ""} {cliente.apellido or ""}'.strip() or 'Cliente',
                    'ci':       getattr(cliente, 'nit_ci', None),
                    'correo':   cliente.correo,
                    'telefono': getattr(cliente, 'telefono', None),
                },
                'plan':            plan,
                'producto_nombre': producto.nombre,
                'recargo_monto':   recargo_monto,
            })
            crear_notificacion(
                tipo='credito',
                titulo=f'Crédito aprobado — {plan.numero_factura}',
                mensaje=(f'Crédito #{plan.id} por {producto.nombre}: '
                         f'{plan.n_cuotas} cuotas de Bs {float(plan.monto_cuota):.2f}.'),
                cliente_id=cliente.id, enlace='/mis-creditos',
                canal='ambos', email=cliente.correo, html=html,
            )
        except Exception:
            pass  # el fallo del correo no debe romper el request

    def create(self, request, *args, **kwargs):
        from django.utils import timezone
        detalle_id = request.data.get('detalle')
        if not detalle_id:
            return Response({'error': 'Falta el ítem de la venta (detalle).'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            detalle = DetalleVenta.objects.select_related('venta', 'producto').get(pk=detalle_id)
        except DetalleVenta.DoesNotExist:
            return Response({'error': 'El ítem de la venta no existe.'}, status=status.HTTP_404_NOT_FOUND)

        # Un plan por ítem de venta
        if PlanCredito.objects.filter(detalle_id=detalle.id).exists():
            return Response({'error': 'Este producto de la venta ya tiene un plan de crédito.'},
                            status=status.HTTP_400_BAD_REQUEST)

        venta = detalle.venta
        # Cliente bloqueado por mora → no se le da más crédito
        if venta.cliente_id:
            venc = Cuota.objects.filter(plan__cliente_id=venta.cliente_id, estado='vencida').count()
            if venc > 0:
                return Response({'error': 'El cliente tiene cuotas vencidas: está bloqueado para nuevos créditos.'},
                                status=status.HTTP_400_BAD_REQUEST)

        calc = calcular_credito(detalle.precio_unitario, detalle.cantidad)
        if not calc:
            return Response({'error': 'El producto no califica a crédito (precio unitario fuera de Bs 1–15.000).'},
                            status=status.HTTP_400_BAD_REQUEST)

        actor = actor_from_request(request)
        usuario_id = actor.get('usuario_id') if actor.get('usuario_rol') in ('admin', 'vendedor') else None

        from django.db import transaction
        try:
            with transaction.atomic():
                plan = PlanCredito.objects.create(
                    venta_id=venta.id, detalle_id=detalle.id, producto_id=detalle.producto_id,
                    cliente_id=venta.cliente_id, usuario_id=usuario_id,
                    precio_unitario=calc['precio_unitario'], cantidad=calc['cantidad'],
                    precio_base=calc['precio_base'], recargo_pct=calc['recargo_pct'],
                    precio_financiado=calc['precio_financiado'], inicial=calc['inicial'],
                    n_cuotas=calc['n_cuotas'], monto_cuota=calc['monto_cuota'],
                    saldo=calc['saldo'], estado='vigente',
                )
                hoy = timezone.localdate()
                for i, monto in enumerate(calc['montos_cuotas'], start=1):
                    Cuota.objects.create(
                        plan_id=plan.id, numero=i, monto=monto, mora=0,
                        fecha_vencimiento=_add_months(hoy, i), estado='pendiente',
                    )
        except Exception as e:
            return Response({'error': f'No se pudo crear el plan de crédito: {e}'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            log_action(
                accion='CREATE', modulo='Crédito',
                descripcion=(f'Plan de crédito #{plan.id} sobre la venta #{venta.id} — '
                             f'{plan.n_cuotas} cuotas (+{plan.recargo_pct}%), '
                             f'inicial Bs {plan.inicial}, financiado Bs {plan.precio_financiado}'),
                **actor,
            )
        except Exception:
            pass
        return Response(PlanCreditoSerializer(plan).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['patch'], url_path='pagar-cuota')
    def pagar_cuota(self, request):
        """
        Registrar el cobro PRESENCIAL en EFECTIVO de una cuota. Marca la cuota
        pagada, actualiza el saldo del plan, emite `numero_factura` desde la
        SEQUENCE, guarda `metodo_pago='efectivo'` y envía la factura al cliente
        (correo Brevo + campana) con el template `facturas/factura_cuota.html`.
        """
        from django.utils import timezone
        cuota_id = request.data.get('cuota')
        try:
            cuota = Cuota.objects.select_related('plan', 'plan__cliente', 'plan__producto').get(pk=cuota_id)
        except Cuota.DoesNotExist:
            return Response({'error': 'La cuota no existe.'}, status=status.HTTP_404_NOT_FOUND)
        if cuota.estado == 'pagada':
            return Response({'error': 'Esa cuota ya está pagada.'}, status=status.HTTP_400_BAD_REQUEST)

        plan = cuota.plan
        actor = actor_from_request(request)
        usuario_id = actor.get('usuario_id') if actor.get('usuario_rol') in ('admin', 'vendedor') else None

        pagado_total = _2d(Decimal(str(cuota.monto)) + Decimal(str(cuota.mora)))
        cuota.estado           = 'pagada'
        cuota.fecha_pago       = timezone.now()
        cuota.usuario_cobro_id = usuario_id
        cuota.metodo_pago      = 'efectivo'
        if not cuota.numero_factura:
            cuota.numero_factura = _siguiente_numero_factura_credito()
        cuota.save(update_fields=[
            'estado', 'fecha_pago', 'usuario_cobro', 'metodo_pago', 'numero_factura',
        ])

        # Bajar el saldo del plan (solo el capital de la cuota, la mora es recargo aparte)
        nuevo_saldo = _2d(Decimal(str(plan.saldo)) - Decimal(str(cuota.monto)))
        plan.saldo = nuevo_saldo if nuevo_saldo > 0 else Decimal('0.00')
        plan.save(update_fields=['saldo'])
        _refrescar_moras(plan)   # recalcula estado (pagado / moroso / vigente)

        try:
            log_action(
                accion='UPDATE', modulo='Crédito',
                descripcion=(f'Cobro EFECTIVO cuota {cuota.numero}/{plan.n_cuotas} del plan #{plan.id} — '
                             f'Bs {pagado_total}, factura {cuota.numero_factura}'
                             + (f' (incluye mora Bs {cuota.mora})' if cuota.mora else '')),
                **actor,
            )
        except Exception:
            pass

        # Correo con factura + campana al cliente
        _notificar_cuota_pagada(cuota)

        plan.refresh_from_db()
        return Response(PlanCreditoSerializer(plan).data)

    @action(detail=False, methods=['get'])
    def cartera(self, request):
        """Resumen de la cartera de créditos para el admin (CU29)."""
        from django.utils import timezone
        planes = list(PlanCredito.objects.select_related('cliente', 'producto').prefetch_related('cuotas'))
        for p in planes:
            _refrescar_moras(p)

        hoy = timezone.localdate()
        total_financiado = Decimal('0'); total_cobrado = Decimal('0')
        por_cobrar = Decimal('0'); en_mora = Decimal('0')
        n_vigentes = n_pagados = n_morosos = 0
        proyeccion = {}   # 'YYYY-MM' → monto que vence ese mes (cuotas pendientes)

        for p in planes:
            total_financiado += Decimal(str(p.precio_financiado))
            total_cobrado    += Decimal(str(p.inicial))
            if p.estado == 'pagado':
                n_pagados += 1
            elif p.estado == 'moroso':
                n_morosos += 1
            else:
                n_vigentes += 1
            for c in p.cuotas.all():
                if c.estado == 'pagada':
                    total_cobrado += Decimal(str(c.monto)) + Decimal(str(c.mora))
                else:
                    por_cobrar += Decimal(str(c.monto)) + Decimal(str(c.mora))
                    if c.estado == 'vencida':
                        en_mora += Decimal(str(c.monto)) + Decimal(str(c.mora))
                    key = f'{c.fecha_vencimiento.year}-{c.fecha_vencimiento.month:02d}'
                    proyeccion[key] = proyeccion.get(key, Decimal('0')) + Decimal(str(c.monto))

        # Clientes bloqueados (con al menos una cuota vencida)
        bloqueados = (Cuota.objects.filter(estado='vencida')
                      .values_list('plan__cliente_id', flat=True).distinct())
        bloqueados = [b for b in bloqueados if b]

        data = self.get_serializer(
            sorted(planes, key=lambda x: x.id, reverse=True), many=True).data
        return Response({
            'resumen': {
                'total_financiado': str(_2d(total_financiado)),
                'total_cobrado':    str(_2d(total_cobrado)),
                'por_cobrar':       str(_2d(por_cobrar)),
                'en_mora':          str(_2d(en_mora)),
                'planes_vigentes':  n_vigentes,
                'planes_pagados':   n_pagados,
                'planes_morosos':   n_morosos,
                'clientes_bloqueados': len(bloqueados),
            },
            'proyeccion': [{'mes': k, 'monto': str(_2d(v))} for k, v in sorted(proyeccion.items())],
            'planes': data,
        })
