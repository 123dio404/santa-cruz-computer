"""
permissions.py — Permisos reutilizables (blindaje del API)

Estas clases leen el claim 'role' del JWT (request.auth) que emite el login.
El backend usa JWTStatelessUserAuthentication: si el token es válido,
request.auth es el diccionario de claims; si no hay token, es None.

  IsAuthenticatedJWT          → requiere un token válido (cualquier rol).
  IsAdmin                     → requiere role == 'admin'.
  PublicCreateElseAuthenticated → POST (registro) libre; el resto requiere token.

Devuelven 401/403 automáticamente cuando la condición no se cumple.
"""
from rest_framework.permissions import BasePermission


class IsAuthenticatedJWT(BasePermission):
    """Requiere un JWT válido (haber iniciado sesión). Cualquier rol."""
    message = 'Autenticación requerida: inicia sesión para continuar.'

    def has_permission(self, request, view):
        return bool(request.auth)


class IsAdmin(BasePermission):
    """Solo usuarios cuyo claim 'role' del JWT sea 'admin'."""
    message = 'Acceso restringido: solo administradores.'

    def has_permission(self, request, view):
        return bool(request.auth and request.auth.get('role') == 'admin')


class PublicCreateElseAuthenticated(BasePermission):
    """
    Pensada para ClienteViewSet:
      - POST create (registro de un nuevo cliente) → público, sin token.
      - Cualquier otra acción (list/retrieve/update/delete) → requiere token.
    """
    message = 'Autenticación requerida.'

    def has_permission(self, request, view):
        if request.method == 'POST' and getattr(view, 'action', None) == 'create':
            return True
        return bool(request.auth)
