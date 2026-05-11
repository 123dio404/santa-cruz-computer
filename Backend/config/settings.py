"""
settings.py — Configuración principal de Django

SECCIONES IMPORTANTES:

SEGURIDAD:
  SECRET_KEY, DEBUG y ALLOWED_HOSTS se leen desde el archivo .env
  usando python-decouple. Nunca hardcodear credenciales aquí.

BASE DE DATOS:
  Todas las variables DB_* vienen del .env. Por defecto usa SQLite
  para desarrollo local, pero en producción apunta a PostgreSQL.
  Todos los modelos usan managed=False → Django no crea ni migra las tablas.

AUTENTICACIÓN JWT (SIMPLE_JWT):
  - Tokens de acceso válidos por 8 horas
  - Tokens de refresco válidos por 7 días
  - Se usa JWTStatelessUserAuthentication para no depender de auth_user
    (la tabla auth_user de Django no existe en este proyecto)

CORS:
  Permite peticiones del frontend React (localhost:5173, 5174, 3000).
  En desarrollo, acepta cualquier puerto de localhost automáticamente
  para evitar problemas cuando Vite cambia de puerto.

EMAIL:
  En desarrollo: imprime los correos en consola (EMAIL_BACKEND=console).
  En producción: configurar SMTP con Resend u otro proveedor via .env.

ARCHIVOS MULTIMEDIA (MEDIA):
  Las imágenes de productos se guardan en /media/productos/.
  En desarrollo, Django los sirve directamente (ver config/urls.py).
  En producción, deberían servirse con Nginx o un bucket de almacenamiento.

PAGINACIÓN:
  Se usa FlexiblePageNumberPagination (config/pagination.py) que permite
  al cliente pedir un tamaño de página personalizado con ?page_size=N.
"""

from pathlib import Path
import os
from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='django-insecure-your-secret-key')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party
    'rest_framework',
    'corsheaders',
    'django_filters',
    
    # Local apps
    'apps.users',
    'apps.products',
    'apps.orders',
    'apps.audit',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database

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


# Password validation

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization

LANGUAGE_CODE = 'es'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static'] if (BASE_DIR / 'static').exists() else []

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# REST Framework Configuration

from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        # JWTStatelessUserAuthentication valida el token sin consultar
        # la tabla auth_user (que no existe en este proyecto).
        # Crea un TokenUser con los claims del JWT en memoria.
        'rest_framework_simplejwt.authentication.JWTStatelessUserAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_PAGINATION_CLASS': 'config.pagination.FlexiblePageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
}

# CORS Configuration

CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://localhost:5174,http://localhost:3000'
).split(',')

# En desarrollo, permitir cualquier origen de localhost / 127.0.0.1 sin importar el puerto.
# Evita problemas cuando Vite decide usar 5174, 5175, etc. si el 5173 está ocupado.
if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r"^http://localhost:\d+$",
        r"^http://127\.0\.0\.1:\d+$",
    ]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# ── Email configuration ───────────────────────────────────────────────────────
# In development (EMAIL_HOST_USER not set) → print codes to console/server log.
# In production → set these in .env and change EMAIL_BACKEND to smtp.
EMAIL_BACKEND      = config('EMAIL_BACKEND',      default='django.core.mail.backends.console.EmailBackend')
EMAIL_HOST         = config('EMAIL_HOST',         default='smtp.gmail.com')
EMAIL_PORT         = config('EMAIL_PORT',         default=587, cast=int)
EMAIL_USE_TLS      = config('EMAIL_USE_TLS',      default=False, cast=bool)
EMAIL_USE_SSL      = config('EMAIL_USE_SSL',      default=False, cast=bool)
EMAIL_HOST_USER    = config('EMAIL_HOST_USER',    default='')
EMAIL_HOST_PASSWORD= config('EMAIL_HOST_PASSWORD',default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='SantaCruz Computer <noreply@santacruz.com>')
