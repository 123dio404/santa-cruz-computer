# SantaCruz Computer — Backend

Sistema ERP para gestión de ventas, inventario, compras, proveedores, clientes y auditoría.

## Tecnologías

- Python 3.13
- Django 4.x + Django REST Framework
- PostgreSQL — base de datos existente (`managed = False` en todos los modelos)
- SimpleJWT — autenticación sin estado
- ReportLab — generación de facturas en PDF
- decouple — variables de entorno

## Estructura

```
Backend/
├── apps/
│   ├── audit/        → Bitácora del sistema (log_action, actor_from_request)
│   ├── orders/       → Ventas, detalles, pagos, facturas, PDF
│   ├── products/     → Productos, categorías, proveedores, compras
│   └── users/        → Usuarios, clientes, login, logout, OTP
├── config/
│   ├── settings.py   → Configuración principal
│   ├── urls.py       → Rutas raíz
│   └── pagination.py → FlexiblePageNumberPagination
└── manage.py
```

## Iniciar el servidor

```bash
python manage.py runserver
```

Servidor disponible en: `http://localhost:8000`

## Variables de entorno (.env)

```
DEBUG=True
SECRET_KEY=tu-secret-key

ALLOWED_HOSTS=localhost,127.0.0.1

DB_ENGINE=django.db.backends.postgresql
DB_NAME=Santacruzcomputer
DB_USER=postgres
DB_PASSWORD=tu_contraseña
DB_HOST=localhost
DB_PORT=5432

CORS_ALLOWED_ORIGINS=http://localhost:5173
JWT_SECRET=tu-jwt-secret

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=tu_correo@gmail.com
EMAIL_HOST_PASSWORD=tu_app_password
DEFAULT_FROM_EMAIL=tu_correo@gmail.com
```

## Crear superusuario (panel /admin/)

```bash
python manage.py migrate    # solo para tablas internas de Django
python manage.py createsuperuser
```

Acceder en: `http://localhost:8000/admin/`

## Roles del sistema

| Rol | Descripción |
|---|---|
| `admin` | Acceso completo |
| `vendedor` | Ventas e inventario |
| `cliente` | Tienda online y pedidos |

## Notas importantes

- `managed = False` en todos los modelos — Django nunca toca las tablas del proyecto
- Los triggers de PostgreSQL gestionan `monto_total` en ventas y compras automáticamente
- `subtotal` en `DetalleVenta` es una columna GENERATED en PostgreSQL
- La bitácora (`bitacora.idusuario`) es FK a `usuario`, no a `cliente` — clientes siempre se registran con `usuario_id=None`
- Paginación flexible: pasar `?page_size=1000` para obtener todos los registros sin paginar
