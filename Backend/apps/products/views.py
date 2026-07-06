"""
views.py — Vistas del módulo de Productos

Contiene los ViewSets para gestionar el catálogo de productos y las compras.

PERMISOS:
  Todos los ViewSets usan AdminWriteOrReadOnly:
  - Lectura (GET):   Cualquier usuario autenticado o anónimo
  - Escritura (POST/PUT/PATCH/DELETE): Solo rol 'admin' (verificado en JWT)

ENDPOINTS ESPECIALES DE PRODUCTO:
  GET  /products/low_stock/         → Productos con stock ≤ stock_mínimo
  POST /products/{id}/adjust_stock/ → Ajustar stock manualmente (admin)

AUDITORÍA:
  Cada operación de crear, modificar, eliminar y ajustar stock registra
  un evento en la bitácora usando log_action() de apps.audit.utils.

ELIMINACIÓN DE PRODUCTOS:
  Si el producto tiene ventas o compras registradas (FK constraint en PostgreSQL),
  la eliminación es bloqueada y se devuelve HTTP 400 con mensaje explicativo.
  Esto protege la integridad del historial financiero.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Categoria, Producto, Proveedor, Compra, DetalleCompra, Promocion
from .serializers import (
    CategoriaSerializer, ProductoSerializer,
    ProveedorSerializer, CompraSerializer, CompraCreateSerializer,
    PromocionSerializer,
)
from .permissions import AdminWriteOrReadOnly
from apps.audit.utils import log_action, actor_from_request


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset           = Categoria.objects.all()
    serializer_class   = CategoriaSerializer
    permission_classes = [AdminWriteOrReadOnly]


class ProductoViewSet(viewsets.ModelViewSet):
    queryset           = Producto.objects.select_related('categoria')
    serializer_class   = ProductoSerializer
    permission_classes = [AdminWriteOrReadOnly]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ['categoria']
    search_fields      = ['nombre', 'marca', 'modelo']
    ordering_fields    = ['nombre', 'precio_actual', 'stock_fisico']
    ordering           = ['-id']

    def perform_create(self, serializer):
        super().perform_create(serializer)
        actor = actor_from_request(self.request)
        p = serializer.instance
        log_action(
            accion='CREATE', modulo='Producto',
            descripcion=f'Se creó el producto "{p.nombre}" (stock: {p.stock_fisico}, precio: {p.precio_actual})',
            **actor,
        )

    def perform_update(self, serializer):
        super().perform_update(serializer)
        actor = actor_from_request(self.request)
        p = serializer.instance
        log_action(
            accion='UPDATE', modulo='Producto',
            descripcion=f'Se modificó el producto "{p.nombre}" ({p.marca or p.id})',
            **actor,
        )

    def destroy(self, request, *args, **kwargs):
        from django.db import IntegrityError
        instance = self.get_object()
        actor = actor_from_request(request)
        try:
            instance.delete()
            log_action(
                accion='DELETE', modulo='Producto',
                descripcion=f'Se eliminó el producto "{instance.nombre}" (ID: {instance.id})',
                **actor,
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except IntegrityError:
            return Response(
                {'error': f'No se puede eliminar "{instance.nombre}" porque tiene ventas o compras registradas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        from django.db.models import F
        productos = Producto.objects.filter(stock_fisico__lte=F('stock_minimo'))
        return Response(self.get_serializer(productos, many=True).data)

    @action(detail=True, methods=['post'])
    def adjust_stock(self, request, pk=None):
        producto = self.get_object()
        try:
            new_stock = int(request.data.get('stock'))
        except (TypeError, ValueError):
            return Response({'error': 'stock debe ser un número entero válido'}, status=status.HTTP_400_BAD_REQUEST)
        if new_stock < 0:
            return Response({'error': 'El stock no puede ser negativo'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            old_stock = producto.stock_fisico
            producto.stock_fisico = new_stock
            producto.save(update_fields=['stock_fisico'])
            producto.refresh_from_db()
            actor = actor_from_request(request)
            log_action(
                accion='STOCK', modulo='Producto',
                descripcion=f'Stock de "{producto.nombre}" ajustado de {old_stock} → {new_stock}',
                **actor,
            )
            return Response(self.get_serializer(producto).data)
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProveedorViewSet(viewsets.ModelViewSet):
    queryset           = Proveedor.objects.all()
    serializer_class   = ProveedorSerializer
    permission_classes = [AdminWriteOrReadOnly]


class CompraViewSet(viewsets.ModelViewSet):
    queryset           = Compra.objects.prefetch_related('detalles').select_related('proveedor')
    permission_classes = [AdminWriteOrReadOnly]
    filter_backends    = [OrderingFilter]
    ordering_fields    = ['fecha_compra']
    ordering           = ['-fecha_compra']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CompraCreateSerializer
        return CompraSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            compra = serializer.instance
            actor = actor_from_request(request)
            log_action(
                accion='COMPRA', modulo='Compra',
                descripcion=f'Se registró la compra #{compra.id} por {float(compra.monto_total or 0):.2f} Bs',
                **actor,
            )
            return Response(CompraSerializer(compra).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PromocionViewSet(viewsets.ModelViewSet):
    """
    Promociones programadas por producto (CU24).
      GET  /promociones/            → lista (página admin)
      GET  /promociones/?producto=  → promociones de un producto
      POST/PUT/PATCH/DELETE          → solo admin (AdminWriteOrReadOnly)
    """
    queryset           = Promocion.objects.select_related('producto').all()
    serializer_class   = PromocionSerializer
    permission_classes = [AdminWriteOrReadOnly]
    filter_backends    = [OrderingFilter]
    ordering_fields    = ['id', 'fecha_inicio', 'fecha_fin']
    ordering           = ['-id']

    def get_queryset(self):
        qs = super().get_queryset()
        producto_id = self.request.query_params.get('producto')
        if producto_id:
            qs = qs.filter(producto_id=producto_id)
        return qs

    def perform_create(self, serializer):
        promo = serializer.save()
        actor = actor_from_request(self.request)
        nombre = promo.producto.nombre if promo.producto else f'#{promo.producto_id}'
        log_action(
            accion='CREATE', modulo='Promoción',
            descripcion=(f'Se creó una promoción de {promo.porcentaje}% para "{nombre}" '
                         f'({promo.fecha_inicio} → {promo.fecha_fin})'),
            **actor,
        )

    def perform_destroy(self, instance):
        actor = actor_from_request(self.request)
        nombre = instance.producto.nombre if instance.producto else f'#{instance.producto_id}'
        pid = instance.id
        instance.delete()
        log_action(
            accion='DELETE', modulo='Promoción',
            descripcion=f'Se eliminó la promoción #{pid} de "{nombre}"',
            **actor,
        )

    @action(detail=False, methods=['post'], url_path='enviar-ofertas')
    def enviar_ofertas(self, request):
        """CU24: envía UN correo con las ofertas vigentes a todos los clientes con
        correo (+ notificación en la campana). Reutiliza y extiende CU21."""
        from django.utils import timezone
        from django.conf import settings as _s
        from apps.users.models import Cliente
        from apps.users.views import crear_notificacion, _email_html

        hoy = timezone.localdate()
        promos = list(Promocion.objects.select_related('producto').filter(
            activo=True, fecha_inicio__lte=hoy, fecha_fin__gte=hoy,
        ))
        if not promos:
            return Response({'error': 'No hay promociones vigentes para enviar.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Tabla HTML de ofertas (común a todos los clientes)
        filas = ''
        for p in promos:
            precio = float(p.producto.precio_actual or 0) if p.producto else 0
            promo  = round(precio * (1 - float(p.porcentaje) / 100), 2)
            nombre = p.producto.nombre if p.producto else '—'
            filas += (
                f'<tr><td style="padding:6px;border-bottom:1px solid #eee;">{nombre}</td>'
                f'<td style="padding:6px;border-bottom:1px solid #eee;text-align:right;text-decoration:line-through;color:#888;">Bs {precio:.2f}</td>'
                f'<td style="padding:6px;border-bottom:1px solid #eee;text-align:right;color:#b45309;font-weight:bold;">Bs {promo:.2f}</td>'
                f'<td style="padding:6px;border-bottom:1px solid #eee;text-align:center;">-{float(p.porcentaje):.0f}%</td></tr>'
            )
        tabla = (
            '<table width="100%" style="border-collapse:collapse;font-size:13px;margin:10px 0;">'
            '<tr style="background:#1e40af;color:#fff;">'
            '<td style="padding:6px;">Producto</td>'
            '<td style="padding:6px;text-align:right;">Antes</td>'
            '<td style="padding:6px;text-align:right;">Ahora</td>'
            '<td style="padding:6px;text-align:center;">Desc.</td></tr>'
            f'{filas}</table>'
        )
        cuerpo_base = ('<p>¡Tenemos ofertas para ti! 🔥</p>' + tabla +
                       '<p style="color:#888;font-size:12px;">Ofertas por tiempo limitado.</p>')

        total = len(promos)
        enviados = 0
        for c in Cliente.objects.exclude(correo__isnull=True).exclude(correo=''):
            nombre = f'{c.nombre} {c.apellido}'.strip()
            html = _email_html(nombre, cuerpo_base, 'Ver ofertas en la tienda', f'{_s.FRONTEND_URL}/store')
            crear_notificacion(
                tipo='oferta', titulo='🔥 ¡Nuevas ofertas en Santa Cruz Computer!',
                mensaje=f'Tenemos {total} producto(s) en oferta. ¡No te lo pierdas!',
                cliente_id=c.id, enlace='/store',
                canal='ambos', email=c.correo, html=html,
            )
            enviados += 1

        actor = actor_from_request(request)
        log_action(
            accion='UPDATE', modulo='Promoción',
            descripcion=f'Se enviaron las ofertas ({total} vigentes) a {enviados} cliente(s)',
            **actor,
        )
        return Response({'enviados': enviados, 'promociones': total})
