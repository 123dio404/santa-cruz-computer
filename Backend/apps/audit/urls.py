"""
urls.py — Rutas del módulo de Auditoría

ENDPOINTS DISPONIBLES (bajo /api/v1/audit/):
  GET  /         → Listar todos los registros de bitácora (solo admin)
  GET  /{id}/    → Ver un registro específico (solo admin)

  Filtros: ?search=<texto>&ordering=fecha
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BitacoraViewSet

router = DefaultRouter()
router.register(r'', BitacoraViewSet, basename='bitacora')

urlpatterns = [
    path('', include(router.urls)),
]
