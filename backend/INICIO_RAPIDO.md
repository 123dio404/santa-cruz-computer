# INSTRUCCIONES: Conectar Django con PostgreSQL Existente

**Objetivo:** Conectar tu backend Django con la BD PostgreSQL "Santacruzcomputer" sin recrear las tablas.

## 🚀 INICIO RÁPIDO (4 pasos)

### PASO 1: Editar .env

```bash
# En carpeta Backend, abre o crea el archivo .env
# Actualiza con tus credenciales:

DEBUG=True
SECRET_KEY=tu-secret-key-aqui
ALLOWED_HOSTS=localhost,127.0.0.1

DB_ENGINE=django.db.backends.postgresql
DB_NAME=Santacruzcomputer
DB_USER=postgres
DB_PASSWORD=TU_CONTRASEÑA_POSTGRES  ← CAMBIA ESTO
DB_HOST=localhost
DB_PORT=5432

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
JWT_SECRET=tu-jwt-secret
```

### PASO 2: Instalar dependencias

```bash
# Activa tu virtual environment primero
pip install -r requirements.txt
```

### PASO 3: Ejecutar script de configuración automática

```bash
# En la carpeta Backend, ejecuta:
python setup_legacy_db.py
```

Este script automáticamente:
- ✅ Verifica .env
- ✅ Instala psycopg2 si falta
- ✅ Prueba conexión a PostgreSQL
- ✅ Inspecciona tu esquema de BD
- ✅ Genera modelos con `inspectdb`

### PASO 4: Revisar y distribuir modelos

Después de ejecutar `setup_legacy_db.py`, se creará `inspected_models.py` con todos los modelos.

Abre este archivo y:
1. Revisa que los campos sean correctos
2. Distribuye los modelos en sus apps:

```bash
# Copiar campos de Usuario a:
apps/users/models.py

# Copiar campos de Producto a:
apps/products/models.py

# Copiar Venta, DetalleVenta, Pago a:
apps/orders/models.py
```

**⚠️ IMPORTANTE:** Todos los modelos deben tener `managed = False` en la clase Meta:

```python
class Meta:
    managed = False  # ← NO DEJES QUE DJANGO TOQUE LAS TABLAS
    db_table = 'nombre_tabla'
```

---

## 🔍 SCRIPTS DE UTILIDAD

### Ver esquema completo de la BD

```bash
python inspect_schema.py
```

Muestra todas las tablas, columnas, índices, claves foráneas y triggers.

### Generar solo los modelos

```bash
python manage.py inspectdb > inspected_models.py
```

---

## 📝 DESPUÉS DE CONFIGURAR

Una vez distribuidos los modelos:

### 1. Actualizar Serializers

En `apps/users/serializers.py`:
```python
from .models import Usuario

class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = '__all__'  # Ajusta según tus campos
```

### 2. Actualizar Vistas

En `apps/users/views.py`:
```python
from rest_framework import viewsets
from .models import Usuario
from .serializers import UsuarioSerializer

class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
```

### 3. Actualizar URLs

En `apps/users/urls.py`:
```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UsuarioViewSet

router = DefaultRouter()
router.register(r'', UsuarioViewSet, basename='usuario')

urlpatterns = [
    path('', include(router.urls)),
]
```

### 4. Probar Conexión

```bash
python manage.py shell

# En el shell:
from apps.users.models import Usuario
print(f"Total usuarios: {Usuario.objects.count()}")
```

### 5. Ejecutar Servidor

```bash
python manage.py runserver
```

Visita: `http://localhost:8000/api/v1/users/`

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### Triggers
Django respetará automáticamente los triggers en PostgreSQL:
- No intentes modificar campos que maneja el trigger desde Django
- Usa las APIs correspondientes en su lugar
- Si necesitas lógica extra, usa Django signals

### no_migrations
Como no vas a usar migraciones de Django:
```bash
# NUNCA hagas esto:
python manage.py makemigrations  # ❌
python manage.py migrate         # ❌

# Solo úsalo si necesitas crear nuevas tablas (no es tu caso)
```

### Nombres de Campos
Si tus columnas en PostgreSQL usan snake_case:
- Django los mapeará automáticamente
- `detalle_venta` → `detalle_venta` (sin cambios)
- Puedes renombrarlos en el modelo si quieres

---

## 🐛 SOLUCIÓN DE PROBLEMAS

| Problema | Solución |
|----------|----------|
| `psycopg2 not found` | `pip install psycopg2-binary` |
| `could not connect to server` | Verifica PostgreSQL está corriendo: `psql -U postgres` |
| `database does not exist` | Verifica nombre en .env: `Santacruzcomputer` |
| `relation does not exist` | Asegúrate que `managed = False` en Meta |
| Modelos vacíos en inspectdb | Ejecuta con verbose: `python manage.py inspectdb -v 2` |

---

## ✅ CHECKLIST FINAL

- [ ] .env configurado con credenciales de PostgreSQL
- [ ] PostgreSQL corriendo y BD "Santacruzcomputer" existe
- [ ] `setup_legacy_db.py` ejecutado exitosamente
- [ ] `inspected_models.py` creado
- [ ] Modelos distribuidos en sus apps
- [ ] `managed = False` en todos los modelos
- [ ] Serializers actualizados
- [ ] Views actualizadas
- [ ] URLs actualizadas
- [ ] Servidor ejecutándose sin errores

---

## 📞 ¿Necesitas Ayuda?

Si algo falla:
1. Lee el mensaje de error completo
2. Ejecuta `python inspect_schema.py` para ver tu esquema
3. Revisa que los nombres de tabla coincidan en la Meta
4. Verifica credenciales en .env

¡Éxito! 🚀
