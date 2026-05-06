# Conectar Django a Base de Datos PostgreSQL Existente

Guía paso a paso para conectar tu backend Django con la BD PostgreSQL "Santacruzcomputer" sin recrear las tablas.

## ✅ Información de tu BD

```
- Nombre: Santacruzcomputer
- Puerto: 5432
- Tablas: usuario, producto, venta, detalle_venta, pago
- Triggers: Manejo de stock y pagos
```

## 📋 Pasos de Configuración

### Paso 1: Crear .env con tus credenciales

```bash
# En la carpeta Backend, copiar el archivo de ejemplo
cp .env.example .env

# Editar .env y cambiar la contraseña de PostgreSQL
# Abre .env y actualiza:
DB_PASSWORD=tu_contraseña_postgres
```

**Contenido de .env:**
```
DEBUG=True
SECRET_KEY=tu-secret-key-aqui
ALLOWED_HOSTS=localhost,127.0.0.1

DB_ENGINE=django.db.backends.postgresql
DB_NAME=Santacruzcomputer
DB_USER=postgres
DB_PASSWORD=tu_contraseña_aqui
DB_HOST=localhost
DB_PORT=5432

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
JWT_SECRET=tu-jwt-secret
```

### Paso 2: Instalar psycopg2-binary (driver PostgreSQL)

```bash
pip install psycopg2-binary
```

Si tienes problemas, instala la versión completa:
```bash
pip install psycopg2
```

### Paso 3: Verificar conexión a PostgreSQL

```bash
# Prueba conectar a tu BD
psql -U postgres -h localhost -d Santacruzcomputer

# Si te conectas exitosamente, escribe:
\dt  # Ver todas las tablas
\q   # Salir
```

### Paso 4: Generar modelos automáticamente (inspectdb)

Django puede inspeccionar tu BD y generar los modelos automáticamente.

```bash
# En la carpeta Backend, ejecuta:
python manage.py inspectdb > apps/inspected_models.py
```

Esto creará `apps/inspected_models.py` con los modelos de tus tablas.

### Paso 5: Revisar y mover los modelos generados

```bash
# Ver el contenido de los modelos generados
type apps\inspected_models.py  # Windows
# o
cat apps/inspected_models.py   # macOS/Linux
```

Los modelos se crearán con `managed = False` (lo que queremos, para no tocar las tablas).

### Paso 6: Organizar modelos en sus apps correspondientes

Tendrás que distribuir los modelos generados en sus apps:

```
- usuario → apps/users/models.py
- producto → apps/products/models.py
- venta, detalle_venta, pago → apps/orders/models.py
```

### Paso 7: Actualizar settings.py (si es necesario)

El settings.py ya está configurado para leer las variables de .env, pero verifica:

```python
DATABASES = {
    'default': {
        'ENGINE': config('DB_ENGINE', default='django.db.backends.sqlite3'),
        'NAME': config('DB_NAME', default=str(BASE_DIR / 'db.sqlite3')),
        'USER': config('DB_USER', default=''),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default=''),
        'PORT': config('DB_PORT', default=''),
    }
}
```

### Paso 8: Crear super usuario (opcional, si aún no existe en tu BD)

```bash
python manage.py createsuperuser
```

### Paso 9: Probar conexión

```bash
python manage.py shell

# En el shell de Python, intenta:
from apps.users.models import Usuario
usuarios = Usuario.objects.all()
print(f"Total usuarios: {usuarios.count()}")
```

### Paso 10: Ejecutar servidor

```bash
python manage.py runserver
```

Visita `http://localhost:8000/api/v1/users/` para ver si funciona.

## 🔄 Ajustes post-inspectdb

Después de generar los modelos con inspectdb, probablemente necesites:

1. **Renombrar campos** que no sigan convenciones de Django
2. **Agregar verbose_name** en la Meta
3. **Actualizar serializers** para que mapeen bien los campos
4. **Verificar primary keys** (debe ser auto_increment)

## ⚠️ Importante: Triggers

Como tienes triggers para manejar stock y pagos:
- Django respetará estos triggers automáticamente
- NO MODIFIQUES directamente los campos que maneja el trigger en Django (usa las APIs en su lugar)
- Si necesitas agregar lógica en Django, hazlo en signals o override del save()

## 🐛 Solución de Problemas

### Error: "psycopg2 not found"
```bash
pip install psycopg2-binary
```

### Error: "could not connect to server"
- Verifica que PostgreSQL esté corriendo
- Verifica host, puerto y credenciales en .env

### Error: "database does not exist"
- Verifica el nombre en DB_NAME (Santacruzcomputer)

### Las tablas no aparecen en inspectdb
```bash
# Ejecuta nuevamente con verbose
python manage.py inspectdb -v 2
```

## ✨ Siguiente Paso

Una vez que los modelos estén listos:
1. Actualiza los serializers en apps/*/serializers.py
2. Ajusta las vistas si es necesario
3. Prueba los endpoints

¿Necesitas ayuda?
