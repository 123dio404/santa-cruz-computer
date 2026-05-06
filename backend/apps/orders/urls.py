from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VentaViewSet, PagoViewSet, DetalleVentaViewSet

router = DefaultRouter()
router.register(r'ventas', VentaViewSet, basename='venta')
router.register(r'pagos', PagoViewSet, basename='pago')
router.register(r'detalles', DetalleVentaViewSet, basename='detalle-venta')

urlpatterns = [
    path('', include(router.urls)),
]
