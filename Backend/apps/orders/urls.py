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
from .views import VentaViewSet, PagoVentaViewSet, DetalleVentaViewSet, FacturaPDFView, GarantiaViewSet, ResenaViewSet, DevolucionViewSet, ServicioCatalogoViewSet, OrdenServicioViewSet, PlanCreditoViewSet
from .stripe_views import (
    CreateCheckoutSessionView, ConfirmCheckoutView,
    CheckoutCuotaView, ConfirmarCuotaView, VerificarCuotaPendienteView,
)
from .voz_views import VozIntencionView

router = DefaultRouter()
router.register(r'ventas',    VentaViewSet,        basename='venta')
router.register(r'pagos',     PagoVentaViewSet,    basename='pago')
router.register(r'detalles',  DetalleVentaViewSet, basename='detalle-venta')
router.register(r'garantias', GarantiaViewSet,     basename='garantia')
router.register(r'resenas',   ResenaViewSet,       basename='resena')
router.register(r'devoluciones', DevolucionViewSet, basename='devolucion')
router.register(r'servicios-catalogo', ServicioCatalogoViewSet, basename='servicio-catalogo')
router.register(r'ordenes-servicio',   OrdenServicioViewSet,    basename='orden-servicio')
router.register(r'planes-credito',     PlanCreditoViewSet,      basename='plan-credito')

urlpatterns = [
    path('', include(router.urls)),
    path('ventas/<int:venta_id>/pdf/', FacturaPDFView.as_view(), name='factura-pdf'),
    path('stripe/create-checkout-session/', CreateCheckoutSessionView.as_view(), name='stripe-create-session'),
    path('stripe/confirm/',                 ConfirmCheckoutView.as_view(),         name='stripe-confirm'),
    # CU28/CU29 — pago online de una cuota de crédito
    path('stripe/checkout-cuota/',          CheckoutCuotaView.as_view(),           name='stripe-checkout-cuota'),
    path('stripe/confirmar-cuota/',         ConfirmarCuotaView.as_view(),          name='stripe-confirmar-cuota'),
    path('stripe/verificar-cuota-pendiente/', VerificarCuotaPendienteView.as_view(), name='stripe-verificar-cuota-pendiente'),
    path('voz-intencion/', VozIntencionView.as_view(), name='voz-intencion'),
]
