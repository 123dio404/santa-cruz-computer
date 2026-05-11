"""
views.py — Vistas del módulo de Auditoría

PERMISOS:
  Solo los administradores (role='admin' en JWT) pueden consultar la bitácora.
  Cualquier otro rol recibe 403 con mensaje explicativo.

BITÁCORA:
  BitacoraViewSet es de solo lectura (ReadOnlyModelViewSet) — solo GET.
  Nadie puede crear, modificar ni eliminar registros de auditoría desde la API.

FILTROS DISPONIBLES:
  ?search=<texto>   → Busca en usuario_nombre, descripcion, modulo, accion, usuario_rol
  ?ordering=fecha   → Ordena por fecha (más reciente primero por defecto)

PAGINACIÓN:
  pagination_class = None → Devuelve TODOS los registros sin paginar.
  La página de AuditLog en el frontend filtra y pagina en el cliente.
"""
from rest_framework import viewsets
from rest_framework.permissions import BasePermission
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Bitacora
from .serializers import BitacoraSerializer


class IsAdminRole(BasePermission):
    """Allow access only to users whose JWT claim 'role' == 'admin'."""
    message = 'Acceso restringido: solo administradores pueden consultar la bitácora.'

    def has_permission(self, request, view):
        return bool(request.auth and request.auth.get('role') == 'admin')


class BitacoraViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = Bitacora.objects.all()
    serializer_class   = BitacoraSerializer
    permission_classes = [IsAdminRole]
    filter_backends    = [SearchFilter, OrderingFilter]
    search_fields      = ['usuario_nombre', 'descripcion', 'modulo', 'accion', 'usuario_rol']
    ordering_fields    = ['fecha']
    ordering           = ['-fecha']
    pagination_class   = None
