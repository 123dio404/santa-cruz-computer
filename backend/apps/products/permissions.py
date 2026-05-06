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
