"""
permissions.py — Permisos del módulo de Productos

AdminWriteOrReadOnly:
  - Lecturas (GET, HEAD, OPTIONS): cualquier petición, sin autenticación requerida
  - Escrituras (POST, PUT, PATCH, DELETE y adjust_stock): solo rol 'admin' en JWT

  Si el token existe pero el rol no es 'admin', devuelve 403 Forbidden.
  Si no hay token en escritura, devuelve 401/403.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS

# Acciones de escritura del ViewSet que requieren rol admin
_WRITE_ACTIONS = {'create', 'update', 'partial_update', 'destroy', 'adjust_stock'}


class AdminWriteOrReadOnly(BasePermission):
    """
    GET/HEAD/OPTIONS y acciones de solo lectura → cualquier petición.
    POST/PUT/PATCH/DELETE y acciones de escritura → solo role='admin' en JWT.
    Devuelve 403 explícito si el token existe pero el rol no es admin.
    """
    def has_permission(self, request, view):
        # Lecturas libres
        if request.method in SAFE_METHODS:
            return True

        # Escrituras: verificar acción del ViewSet si está disponible
        action = getattr(view, 'action', None)
        if action and action not in _WRITE_ACTIONS:
            return True  # acciones de solo lectura como list/retrieve

        # Requiere JWT con role='admin'
        if not request.auth:
            return False
        return request.auth.get('role') == 'admin'


class AdminWriteStaffRead(BasePermission):
    """
    Como AdminWriteOrReadOnly, pero la LECTURA también exige token (no público).
    Para datos internos que no deben verse sin sesión: proveedores y compras
    (costos de compra, datos de proveedor).
      - GET/HEAD/OPTIONS → cualquier usuario autenticado (con token válido).
      - POST/PUT/PATCH/DELETE → solo role='admin'.
    """
    message = 'Acceso restringido: inicia sesión.'

    def has_permission(self, request, view):
        if not request.auth:
            return False  # ni siquiera leer sin sesión
        if request.method in SAFE_METHODS:
            return True
        return request.auth.get('role') == 'admin'
