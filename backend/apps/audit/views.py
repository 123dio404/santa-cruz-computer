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
