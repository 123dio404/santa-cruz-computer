from apps.users.models import Usuario
from apps.products.models import Producto

print(f'Usuarios en BD: {Usuario.objects.count()}')
print(f'Productos en BD: {Producto.objects.count()}')
print('Conexión OK')
