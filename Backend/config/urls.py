"""
urls.py — Rutas raíz del proyecto

Monta cada módulo bajo su prefijo /api/v1/:

  /api/v1/users/    → apps.users.urls    (login, usuarios, clientes, OTP)
  /api/v1/products/ → apps.products.urls (productos, categorías, proveedores, compras)
  /api/v1/orders/   → apps.orders.urls   (ventas, pagos, detalles, PDF de factura)
  /api/v1/audit/    → apps.audit.urls    (bitácora — solo admin)
  /admin/           → Panel de administración de Django (uso interno)

ARCHIVOS ESTÁTICOS EN DESARROLLO:
  En modo DEBUG=True, Django sirve /media/ directamente desde MEDIA_ROOT.
  En producción esto debe hacerse con Nginx o un servicio de almacenamiento externo.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/users/', include('apps.users.urls')),
    path('api/v1/products/', include('apps.products.urls')),
    path('api/v1/orders/', include('apps.orders.urls')),
    path('api/v1/audit/', include('apps.audit.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
