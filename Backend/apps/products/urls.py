"""
urls.py — Rutas del módulo de Productos

ENDPOINTS DISPONIBLES (bajo /api/v1/products/):
  GET/POST         /                     → Listar o crear productos
  GET/PUT/PATCH    /{id}/                → Ver, editar o eliminar un producto
  GET              /low_stock/           → Productos con stock ≤ mínimo configurado
  POST             /{id}/adjust_stock/   → Ajustar stock manualmente (admin)

  GET/POST         /categorias/          → Listar o crear categorías
  GET/POST         /proveedores/         → Listar o crear proveedores
  GET/POST         /compras/             → Listar o registrar compras a proveedores

NOTA: ProductoViewSet se registra en la raíz ('') pero después de CategoriaViewSet,
ProveedorViewSet y CompraViewSet para que sus rutas específicas no sean sobrescritas.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoriaViewSet, ProductoViewSet, ProveedorViewSet, CompraViewSet

router = DefaultRouter()
router.register(r'categorias',  CategoriaViewSet,  basename='categoria')
router.register(r'proveedores', ProveedorViewSet,  basename='proveedor')
router.register(r'compras',     CompraViewSet,     basename='compra')
router.register(r'',            ProductoViewSet,   basename='producto')

urlpatterns = [
    path('', include(router.urls)),
]
