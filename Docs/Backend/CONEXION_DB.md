# Conexión a Base de Datos

## Base de datos

- **Nombre**: Santacruzcomputer
- **Motor**: PostgreSQL
- **Puerto**: 5432
- **Host**: localhost

## Tablas del proyecto

| Tabla | App Django | Descripción |
|---|---|---|
| `usuario` | users | Administradores y vendedores |
| `cliente` | users | Clientes de la tienda |
| `otp_recovery` | users | Códigos de recuperación de contraseña |
| `producto` | products | Catálogo de productos |
| `categoria` | products | Categorías de productos |
| `proveedor` | products | Proveedores |
| `compra` | products | Compras a proveedores |
| `detalle_compra` | products | Detalle de líneas de compra |
| `venta` | orders | Ventas (presenciales y online) |
| `detalle_venta` | orders | Líneas de venta |
| `pago_venta` | orders | Pagos asociados a ventas |
| `factura` | orders | Facturas generadas |
| `bitacora` | audit | Registro de auditoría |

## Triggers de PostgreSQL

Los siguientes campos son manejados por triggers en la BD, **no modificar desde Django**:

- `venta.monto_total` — calculado automáticamente al insertar/actualizar detalles
- `compra.monto_total` — calculado al insertar detalles de compra
- `detalle_venta.subtotal` — columna GENERATED (`precio_unitario * cantidad`)

## Importante: managed = False

Todos los modelos tienen `managed = False`. Esto significa que Django **nunca** crea ni modifica estas tablas. Solo las lee y escribe a través de la ORM.

```python
class Meta:
    managed = False
    db_table = 'nombre_tabla'
```

## Configuración en .env

```
DB_ENGINE=django.db.backends.postgresql
DB_NAME=Santacruzcomputer
DB_USER=postgres
DB_PASSWORD=tu_contraseña
DB_HOST=localhost
DB_PORT=5432
```

## Probar conexión desde Django shell

```bash
python manage.py shell
```

```python
from apps.users.models import Usuario
from apps.products.models import Producto
print(f'Usuarios: {Usuario.objects.count()}')
print(f'Productos: {Producto.objects.count()}')
```
