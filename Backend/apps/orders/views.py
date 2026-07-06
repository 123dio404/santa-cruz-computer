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
  permission_classes = [] → Sin restricción de permisos (cualquier usuario autenticado
  puede operar). El control de acceso se hace a nivel de negocio en el frontend.
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
from .models import Venta, DetalleVenta, PagoVenta, Factura, EstadoSiat, Garantia, Resena, Devolucion
from .serializers import (
    VentaSerializer, VentaCreateSerializer,
    DetalleVentaSerializer, PagoVentaSerializer, GarantiaSerializer, ResenaSerializer,
    DevolucionSerializer,
)
from apps.audit.utils import log_action, actor_from_request
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
    queryset          = Venta.objects.prefetch_related('detalles', 'detalles__producto', 'pagos').select_related('cliente', 'usuario')
    serializer_class  = VentaSerializer
    permission_classes = []
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
    permission_classes = []
    filter_backends    = [OrderingFilter]
    ordering_fields    = ['fecha']
    ordering           = ['-fecha']


class DetalleVentaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = DetalleVenta.objects.all()
    serializer_class   = DetalleVentaSerializer
    permission_classes = []
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
    permission_classes = []
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
    permission_classes = []
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
    permission_classes = []
    http_method_names  = ['get', 'post', 'head', 'options']
    filter_backends    = [OrderingFilter]
    ordering_fields    = ['id', 'fecha']
    ordering           = ['-id']

    DIAS_DEVOLUCION = 7

    def get_queryset(self):
        qs = super().get_queryset()
        venta_id = self.request.query_params.get('venta')
        if venta_id:
            qs = qs.filter(venta_id=venta_id)
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

        if cantidad < 1:
            return Response({'error': 'La cantidad debe ser al menos 1.'}, status=status.HTTP_400_BAD_REQUEST)
        if not motivo:
            return Response({'error': 'Indica el motivo de la devolución.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            detalle = DetalleVenta.objects.select_related('venta', 'producto').get(pk=detalle_id)
        except DetalleVenta.DoesNotExist:
            return Response({'error': 'El ítem de la venta no existe.'}, status=status.HTTP_404_NOT_FOUND)

        venta = detalle.venta

        if aprobar:
            # (1) Plazo <= 7 días desde la venta. Se compara por FECHA (día) para
            # evitar el choque naive/aware entre fecha_venta y timezone.now().
            if venta.fecha_venta and (timezone.now().date() - venta.fecha_venta.date()).days > self.DIAS_DEVOLUCION:
                return Response(
                    {'error': f'Fuera de plazo: la venta tiene más de {self.DIAS_DEVOLUCION} días. Solo puedes rechazar.'},
                    status=status.HTTP_400_BAD_REQUEST)
            # (2) No devuelto antes: cantidad disponible del ítem
            ya = Devolucion.objects.filter(detalle_id=detalle.id, estado='aprobada').aggregate(t=Sum('cantidad'))['t'] or 0
            disponible = detalle.cantidad - ya
            if cantidad > disponible:
                return Response(
                    {'error': f'Solo quedan {disponible} unidad(es) por devolver de este ítem.'},
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
            )
            # Al APROBAR: anular la garantía de ese ítem (el producto vuelve a la tienda)
            if aprobar:
                Garantia.objects.filter(detalle_id=detalle.id).exclude(estado='anulada').update(estado='anulada')
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
        return Response(DevolucionSerializer(dev).data, status=status.HTTP_201_CREATED)
