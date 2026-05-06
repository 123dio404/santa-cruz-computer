import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import Usuario
print(f"Usuarios en BD: {Usuario.objects.count()}")

from apps.products.models import Producto
print(f"Productos en BD: {Producto.objects.count()}")

print("Conexion OK")
