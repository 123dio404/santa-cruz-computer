# Sistema de Gestión de Inventario - Backend

Backend Django + Django REST Framework para Sistema de Gestión de Inventario de SantaCruz Computer.

## 🚀 Características

- ✅ Autenticación con JWT
- ✅ Control de roles (Admin, Empleado, Cliente)
- ✅ API REST completa
- ✅ Gestión de productos y categorías
- ✅ Gestión de inventario con movimientos
- ✅ Sistema de órdenes y pagos
- ✅ Registro de auditoría
- ✅ Documentación automática con DRF
- ✅ CORS configurado para React
- ✅ Preparado para PostgreSQL

## 📋 Requisitos

- Python 3.8+
- PostgreSQL (opcional, puede usar SQLite para desarrollo)
- pip

## 🔧 Instalación

### 1. Crear Entorno Virtual

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 2. Instalar Dependencias

```bash
pip install -r requirements.txt
```

### 3. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar .env con tus configuraciones:
# - DEBUG=True (para desarrollo)
# - SECRET_KEY=tu-clave-secreta
# - BD_PASSWORD=tu-contraseña-postgres
# - etc.
```

### 4. Crear Base de Datos (PostgreSQL)

```bash
# Conectar a PostgreSQL
psql -U postgres

# Crear base de datos
CREATE DATABASE inventario_db;

# Salir
\q
```

### 5. Ejecutar Migraciones

```bash
python manage.py makemigrations
python manage.py migrate
```

### 6. Crear Superusuario (Admin)

```bash
python manage.py createsuperuser
```

## 🏃 Ejecutar el Servidor

```bash
python manage.py runserver
```

El servidor estará disponible en: `http://localhost:8000`

## 📚 Estructura del Proyecto

```
Backend/
├── config/                 # Configuración del proyecto
│   ├── settings.py        # Configuraciones de Django
│   ├── urls.py            # URLs principales
│   └── wsgi.py            # WSGI para producción
├── apps/
│   ├── users/             # Gestión de usuarios y autenticación
│   │   ├── models.py      # Modelo de usuario extendido
│   │   ├── views.py       # Vistas de usuario
│   │   ├── serializers.py # Serializadores
│   │   ├── urls.py        # URLs de usuarios
│   │   └── admin.py       # Admin de Django
│   ├── products/          # Gestión de productos e inventario
│   │   ├── models.py      # Product, Category, Supplier, InventoryMovement
│   │   ├── views.py       # Vistas de productos
│   │   ├── serializers.py # Serializadores
│   │   └── urls.py        # URLs de productos
│   ├── orders/            # Gestión de órdenes y pagos
│   │   ├── models.py      # Order, OrderItem, Payment
│   │   ├── views.py       # Vistas de órdenes
│   │   ├── serializers.py # Serializadores
│   │   └── urls.py        # URLs de órdenes
│   └── audit/             # Registro de auditoría
│       ├── models.py      # AuditLog
│       ├── views.py       # Vistas de auditoría
│       ├── serializers.py # Serializadores
│       └── urls.py        # URLs de auditoría
├── manage.py              # Utilidad CLI de Django
├── requirements.txt       # Dependencias Python
└── .env.example          # Variables de entorno (ejemplo)
```

## 🔐 Autenticación

### Login

```bash
POST /api/v1/users/login/
Content-Type: application/json

{
  "username": "usuario",
  "password": "contraseña"
}

# Response:
{
  "refresh": "token_refresh",
  "access": "token_access",
  "user": { ... }
}
```

### Usar Token en Requests

```bash
GET /api/v1/products/
Authorization: Bearer {access_token}
```

## 📡 Endpoints Principales

### Usuarios
- `GET /api/v1/users/` - Listar usuarios (solo admin)
- `POST /api/v1/users/` - Crear usuario
- `POST /api/v1/users/login/` - Login
- `GET /api/v1/users/me/` - Mi perfil
- `GET /api/v1/users/by_role/?role=admin` - Usuarios por rol

### Productos
- `GET /api/v1/products/` - Listar productos
- `POST /api/v1/products/` - Crear producto
- `GET /api/v1/products/{id}/` - Detalle de producto
- `PUT /api/v1/products/{id}/` - Actualizar producto
- `DELETE /api/v1/products/{id}/` - Eliminar producto
- `GET /api/v1/products/low_stock/` - Productos con stock bajo
- `POST /api/v1/products/{id}/adjust_quantity/` - Ajustar cantidad

### Órdenes
- `GET /api/v1/orders/` - Listar órdenes
- `POST /api/v1/orders/` - Crear orden
- `GET /api/v1/orders/{id}/` - Detalle de orden
- `POST /api/v1/orders/create_from_cart/` - Crear desde carrito
- `POST /api/v1/orders/{id}/add_payment/` - Agregar pago
- `PATCH /api/v1/orders/{id}/update_status/` - Actualizar estado

### Auditoría
- `GET /api/v1/audit/` - Ver registros de auditoría

## 🧪 Testing

```bash
# Ejecutar todas las pruebas
python manage.py test

# Con verbose
python manage.py test -v 2
```

## 🐘 Usar PostgreSQL

1. Instalar PostgreSQL
2. Instalar driver: `pip install psycopg2-binary`
3. Editar `.env`:
   ```
   DB_ENGINE=django.db.backends.postgresql
   DB_NAME=inventario_db
   DB_USER=postgres
   DB_PASSWORD=tu_contraseña
   DB_HOST=localhost
   DB_PORT=5432
   ```
4. Ejecutar migraciones nuevamente

## 📝 Configuración de CORS

Para conectar con el frontend React, CORS está configurado en `settings.py`:

```python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',  # Vite dev server
    'http://localhost:3000',   # Alternativo
]
```

Editar según necesites en `.env`:
```
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

## 🚢 Deployment

### Producción

1. Cambiar `DEBUG=False` en `.env`
2. Generar `SECRET_KEY` segura
3. Usar PostgreSQL
4. Configurar allowed hosts
5. Usar Gunicorn: `pip install gunicorn`
6. Ejecutar: `gunicorn config.wsgi`

### Collectar archivos estáticos

```bash
python manage.py collectstatic
```

## 📚 Admin Panel

Acceder en: `http://localhost:8000/admin/`

Usa el superusuario creado en la instalación.

## 🤝 Próximos Pasos

- [ ] Conectar con frontend React
- [ ] Implementar pruebas unitarias
- [ ] Agregar más validaciones
- [ ] Implementar caché
- [ ] Agregar filtros avanzados
- [ ] Documentar con Swagger/OpenAPI

## 📞 Soporte

Para preguntas o issues, contactar al equipo de desarrollo.

---

**Desarrollado con ❤️ para SantaCruz Computer**
