# Inicio Rápido — Backend

## Requisitos previos

- Python 3.13 instalado
- PostgreSQL corriendo con la base de datos `Santacruzcomputer`

## Pasos

**1. Ir a la carpeta Backend**
```
cd "proyecto si1 santacruz computer\Backend"
```

**2. Instalar dependencias**
```bash
pip install -r requirements.txt
```

**3. Configurar el archivo .env**

Crear o editar el archivo `.env` en la carpeta Backend:
```
DEBUG=True
SECRET_KEY=tu-secret-key
ALLOWED_HOSTS=localhost,127.0.0.1

DB_ENGINE=django.db.backends.postgresql
DB_NAME=Santacruzcomputer
DB_USER=postgres
DB_PASSWORD=tu_contraseña_postgres
DB_HOST=localhost
DB_PORT=5432

CORS_ALLOWED_ORIGINS=http://localhost:5173
JWT_SECRET=tu-jwt-secret
```

**4. Aplicar migraciones internas de Django** (solo tablas de admin/auth, no toca las del proyecto)
```bash
python manage.py migrate
```

**5. Iniciar el servidor**
```bash
python manage.py runserver
```

El backend estará disponible en `http://localhost:8000`

## Verificar que funciona

```bash
# Listar productos
curl http://localhost:8000/api/v1/products/?page_size=100

# Login
curl -X POST http://localhost:8000/api/v1/users/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "tu_usuario", "password": "tu_contraseña"}'
```

## Solución de problemas

| Error | Solución |
|---|---|
| `psycopg2 not found` | `pip install psycopg2-binary` |
| `could not connect to server` | Verificar que PostgreSQL está corriendo |
| `database does not exist` | Verificar `DB_NAME=Santacruzcomputer` en .env |
| `relation does not exist` | Verificar `managed = False` en los modelos |
| Solo 20 registros en respuesta | Agregar `?page_size=1000` a la URL |
