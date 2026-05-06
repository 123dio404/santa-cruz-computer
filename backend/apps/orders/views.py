from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone
from .models import Venta, DetalleVenta, Pago
from .serializers import VentaSerializer, VentaCreateSerializer, DetalleVentaSerializer, PagoSerializer
from apps.audit.utils import log_action, actor_from_request


class VentaViewSet(viewsets.ModelViewSet):
    queryset = Venta.objects.all()
    serializer_class = VentaSerializer
    permission_classes = []
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'vendedor', 'cliente']
    search_fields = ['cliente__name', 'vendedor__name']
    ordering_fields = ['fecha', 'total']
    ordering = ['-fecha']
    
    def get_serializer_class(self):
        """
        Usar VentaCreateSerializer para POST (crear ventas con detalles)
        Usar VentaSerializer para GET y otros métodos
        """
        if self.request.method == 'POST':
            return VentaCreateSerializer
        return VentaSerializer
    
    def create(self, request, *args, **kwargs):
        """Crear venta con manejo de errores y registro en bitácora."""
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            venta = Venta.objects.get(id=serializer.instance.id)
            actor = actor_from_request(request)
            log_action(
                accion='VENTA', modulo='Venta',
                descripcion=(
                    f'Se registró la venta #{venta.id} '
                    f'por {float(venta.total or 0):.2f} Bs '
                    f'(cliente ID: {venta.cliente_id or "sin cliente"})'
                ),
                **actor,
            )
            return Response(VentaSerializer(venta).data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        venta = self.get_object()
        serializer = self.get_serializer(venta, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        venta.refresh_from_db()
        return Response(VentaSerializer(venta).data)

    @action(detail=False, methods=['get'])
    def by_status(self, request):
        """Get ventas filtered by status"""
        status_filter = request.query_params.get('status')
        if status_filter:
            ventas = Venta.objects.filter(status=status_filter)
        else:
            ventas = Venta.objects.all()
        
        serializer = self.get_serializer(ventas, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_vendedor(self, request):
        """Get ventas realizadas por un vendedor específico"""
        vendedor_id = request.query_params.get('vendedor_id')
        if not vendedor_id:
            return Response(
                {'error': 'vendedor_id es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        ventas = Venta.objects.filter(vendedor_id=vendedor_id)
        serializer = self.get_serializer(ventas, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def historial(self, request):
        """Get historial de ventas del vendedor autenticado"""
        vendedor_id = request.query_params.get('vendedor_id')
        if not vendedor_id:
            return Response(
                {'error': 'vendedor_id es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        ventas = Venta.objects.filter(vendedor_id=vendedor_id).prefetch_related('detalles', 'pagos')
        serializer = self.get_serializer(ventas, many=True)
        
        # Calcular estadísticas
        total_ventas = ventas.count()
        total_monto = sum(v.total or 0 for v in ventas)
        
        return Response({
            'total_ventas': total_ventas,
            'total_monto': float(total_monto),
            'ventas': serializer.data
        })


class PagoViewSet(viewsets.ModelViewSet):
    queryset = Pago.objects.all()
    serializer_class = PagoSerializer
    permission_classes = []
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['metodo']
    ordering_fields = ['fecha']
    ordering = ['-fecha']


class DetalleVentaViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for sale details"""
    queryset = DetalleVenta.objects.all()
    serializer_class = DetalleVentaSerializer
    permission_classes = []
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['venta', 'producto']
    ordering_fields = ['created_at']
