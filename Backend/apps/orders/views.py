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
from .models import Venta, DetalleVenta, PagoVenta, Factura, EstadoSiat
from .serializers import (
    VentaSerializer, VentaCreateSerializer,
    DetalleVentaSerializer, PagoVentaSerializer,
)
from apps.audit.utils import log_action, actor_from_request


class FacturaPDFView(View):
    """Genera la factura PDF de una venta completada usando ReportLab."""
    def get(self, request, venta_id):
        try:
            venta = (
                Venta.objects
                .prefetch_related('detalles__producto', 'pagos')
                .select_related('cliente', 'usuario')
                .get(pk=venta_id)
            )
        except Venta.DoesNotExist:
            raise Http404('Venta no encontrada')

        if venta.estado != 'completed':
            return HttpResponse('La factura solo está disponible para ventas completadas.', status=403)

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

        tabla_data = [[
            Paragraph('#',              header_style),
            Paragraph('Producto',       header_style),
            Paragraph('Cant.',          header_style),
            Paragraph('Precio Unit.',   header_style),
            Paragraph('Subtotal',       header_style),
        ]]

        for i, det in enumerate(venta.detalles.all(), 1):
            nombre_prod = det.producto.nombre if det.producto else f'Producto #{det.producto_id}'
            tabla_data.append([
                Paragraph(str(i), cell_style),
                Paragraph(nombre_prod, cell_style),
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

        total_data = [
            ['', Paragraph(f'<b>Método(s) de pago:</b> {metodos_str}', s_normal)],
            ['', Paragraph(f'<b>TOTAL:</b>  Bs {float(venta.monto_total):.2f}', s_total)],
        ]
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
        buffer.seek(0)
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="factura-{nro}.pdf"'
        response['Access-Control-Allow-Origin'] = '*'
        return response


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
