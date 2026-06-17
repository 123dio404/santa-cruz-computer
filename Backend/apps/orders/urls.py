"""
urls.py — Rutas del módulo de Ventas

ENDPOINTS DISPONIBLES (bajo /api/v1/orders/):
  GET/POST   /ventas/                          → Listar o crear ventas
  GET/PATCH  /ventas/{id}/                     → Ver o actualizar una venta
  PATCH      /ventas/{id}/confirmar_entrega/   → Confirmar entrega (admin)
  GET        /ventas/by_vendedor/?vendedor_id= → Ventas de un vendedor
  GET        /ventas/historial/?vendedor_id=   → Estadísticas del vendedor
  GET        /ventas/{id}/pdf/                 → Descargar factura en PDF

  GET/POST   /pagos/                           → Listar o registrar pagos
  GET        /detalles/                        → Solo lectura de ítems de ventas
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VentaViewSet, PagoVentaViewSet, DetalleVentaViewSet, FacturaPDFView, GarantiaViewSet, ResenaViewSet
from .stripe_views import CreateCheckoutSessionView, ConfirmCheckoutView

router = DefaultRouter()
router.register(r'ventas',    VentaViewSet,        basename='venta')
router.register(r'pagos',     PagoVentaViewSet,    basename='pago')
router.register(r'detalles',  DetalleVentaViewSet, basename='detalle-venta')
router.register(r'garantias', GarantiaViewSet,     basename='garantia')
router.register(r'resenas',   ResenaViewSet,       basename='resena')

urlpatterns = [
    path('', include(router.urls)),
    path('ventas/<int:venta_id>/pdf/', FacturaPDFView.as_view(), name='factura-pdf'),
    path('stripe/create-checkout-session/', CreateCheckoutSessionView.as_view(), name='stripe-create-session'),
    path('stripe/confirm/', ConfirmCheckoutView.as_view(), name='stripe-confirm'),
]
