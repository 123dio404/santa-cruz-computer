"""
pagination.py — Paginación configurable por el cliente

FlexiblePageNumberPagination extiende el paginador estándar de DRF para
permitir que el frontend solicite un tamaño de página diferente al default:

  ?page=2          → Segunda página
  ?page_size=50    → 50 resultados por página (máximo: 10000)

El límite de 10000 permite cargar todos los registros de la bitácora de una
sola vez, que el frontend filtra y pagina localmente en AuditLog.tsx.

Configurado en settings.py como DEFAULT_PAGINATION_CLASS.
"""
from rest_framework.pagination import PageNumberPagination


class FlexiblePageNumberPagination(PageNumberPagination):
    """Paginador que acepta ?page_size= del cliente con tope en 10000."""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 10000
