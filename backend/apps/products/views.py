from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Categoria, Producto
from .serializers import CategoriaSerializer, ProductoSerializer
from .permissions import AdminWriteOrReadOnly
from apps.audit.utils import log_action, actor_from_request


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [AdminWriteOrReadOnly]


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer
    permission_classes = [AdminWriteOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['estado', 'categoria']
    search_fields = ['name', 'marca', 'modelo']
    ordering_fields = ['name', 'price', 'stock', 'created_at']
    ordering = ['-created_at']

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        super().perform_create(serializer)
        actor = actor_from_request(self.request)
        p = serializer.instance
        log_action(
            accion='CREATE', modulo='Producto',
            descripcion=f'Se creó el producto "{p.name}" (stock: {p.stock}, precio venta: {p.precio_venta})',
            **actor,
        )

    def perform_update(self, serializer):
        super().perform_update(serializer)
        actor = actor_from_request(self.request)
        p = serializer.instance
        log_action(
            accion='UPDATE', modulo='Producto',
            descripcion=f'Se modificó el producto "{p.name}" (ID: {p.id})',
            **actor,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        actor = actor_from_request(request)
        log_action(
            accion='DELETE', modulo='Producto',
            descripcion=f'Se eliminó el producto "{instance.name}" (ID: {instance.id})',
            **actor,
        )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        # Filtra productos donde stock actual <= stock_minimo definido por producto
        from django.db.models import F
        productos = Producto.objects.filter(stock__lte=F('stock_minimo'))
        serializer = self.get_serializer(productos, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def adjust_stock(self, request, pk=None):
        producto = self.get_object()

        # Conversión explícita: el frontend puede enviar string o int
        try:
            new_stock = int(request.data.get('stock'))
        except (TypeError, ValueError):
            return Response(
                {'error': 'stock debe ser un número entero válido'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_stock < 0:
            return Response(
                {'error': 'El stock no puede ser negativo'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            old_stock = producto.stock
            producto.stock = new_stock
            producto.save(update_fields=['stock'])
            producto.refresh_from_db()
            actor = actor_from_request(request)
            log_action(
                accion='STOCK', modulo='Producto',
                descripcion=f'Stock de "{producto.name}" ajustado de {old_stock} → {new_stock} unidades',
                **actor,
            )
            return Response(self.get_serializer(producto).data)
        except Exception as exc:
            return Response(
                {'error': f'Error al guardar el stock: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
