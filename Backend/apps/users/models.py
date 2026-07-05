"""
models.py — Módulo de Usuarios

Define los modelos de la base de datos para las dos tablas de personas del sistema:
- Usuario: personal interno (admin y vendedores)
- Cliente: compradores registrados en la tienda

IMPORTANTE: managed = False en todos los modelos significa que Django NO crea
ni modifica estas tablas. La estructura ya existe en PostgreSQL y Django solo
la usa para leer y escribir datos. Cualquier cambio de columnas debe hacerse
directamente en la base de datos (no con migraciones de Django).
"""
from django.db import models


# Roles disponibles para usuarios del sistema (no incluye clientes)
class RolUsuario(models.TextChoices):
    ADMIN    = 'admin',    'Administrador'
    VENDEDOR = 'vendedor', 'Vendedor'


class Usuario(models.Model):
    """Personal interno del sistema: administradores y vendedores."""
    id               = models.AutoField(primary_key=True, db_column='idusuario')
    nombre_completo  = models.CharField(max_length=150)
    username         = models.CharField(max_length=50, unique=True)
    # La contraseña se guarda hasheada con Django's make_password (bcrypt/PBKDF2)
    password_hash    = models.TextField()
    rol              = models.CharField(max_length=30, choices=RolUsuario.choices)
    activo           = models.BooleanField(default=True)
    email            = models.CharField(max_length=100, blank=True, null=True)
    telefono         = models.CharField(max_length=20, blank=True, null=True)
    ciudad           = models.CharField(max_length=100, blank=True, null=True)
    fecha_nacimiento = models.DateField(blank=True, null=True)

    class Meta:
        managed             = False   # Django no gestiona esta tabla
        db_table            = 'usuario'
        verbose_name        = 'Usuario'
        verbose_name_plural = 'Usuarios'
        ordering            = ['id']   # evita UnorderedObjectListWarning al paginar

    def __str__(self):
        return self.username


class Cliente(models.Model):
    """Clientes registrados desde la tienda online o creados por el admin."""
    id               = models.AutoField(primary_key=True, db_column='idcliente')
    nombre           = models.CharField(max_length=150)
    apellido         = models.CharField(max_length=150)
    # usuario_login es el nombre de usuario para login del cliente (equivale a username en Usuario)
    usuario_login    = models.CharField(max_length=50, unique=True, blank=True, null=True)
    correo           = models.CharField(max_length=100, unique=True, blank=True, null=True)
    sexo             = models.CharField(max_length=20, blank=True, null=True)
    ciudad           = models.CharField(max_length=100, blank=True, null=True)
    telefono         = models.CharField(max_length=20, blank=True, null=True)
    fecha_nacimiento = models.DateField(blank=True, null=True)
    nit_ci           = models.CharField(max_length=20, blank=True, null=True)
    razon_social     = models.CharField(max_length=150, blank=True, null=True)
    # La contraseña del cliente también se hashea (make_password) igual que Usuario
    password         = models.CharField(max_length=255, blank=True, null=True)
    # Descuento VIP por fidelidad: cada 10000 Bs acumulados otorga 200 Bs de descuento
    total_acumulado      = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    descuento_disponible = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        managed             = False   # Django no gestiona esta tabla
        db_table            = 'cliente'
        verbose_name        = 'Cliente'
        verbose_name_plural = 'Clientes'
        ordering            = ['id']   # evita UnorderedObjectListWarning al paginar

    def __str__(self):
        return f'{self.nombre} {self.apellido}'


class OTPRecovery(models.Model):
    """
    Modelo definido pero NO usado activamente (la tabla otp_recovery no existe en BD).
    Los OTPs se almacenan en memoria en el dict _otps de users/views.py.
    Se mantiene este modelo por compatibilidad futura.
    """
    usuario_id = models.IntegerField()
    email      = models.CharField(max_length=100)
    code       = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    used       = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed  = False
        db_table = 'otp_recovery'


class Notificacion(models.Model):
    """
    Notificación dirigida a UN usuario interno (usuario) O a UN cliente (CU21).
    Siempre aparece en la campana; si canal='ambos' además se envía por correo
    (Brevo). Tabla creada por SQL manual (managed=False): 004_notificaciones.sql
    """
    id        = models.AutoField(primary_key=True, db_column='idnotificacion')
    usuario   = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, db_column='idusuario',
        related_name='notificaciones', null=True, blank=True,
    )
    cliente   = models.ForeignKey(
        Cliente, on_delete=models.CASCADE, db_column='idcliente',
        related_name='notificaciones', null=True, blank=True,
    )
    tipo      = models.CharField(max_length=30)          # venta | reclamo | reclamo_resuelto | bienvenida | resena ...
    titulo    = models.CharField(max_length=150)
    mensaje   = models.TextField()
    enlace    = models.CharField(max_length=200, null=True, blank=True)   # ruta interna, ej. /warranties
    canal     = models.CharField(max_length=20, default='sistema')        # sistema | ambos (ambos = app + correo)
    leido     = models.BooleanField(default=False)
    fecha     = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed             = False
        db_table            = 'notificacion'
        verbose_name        = 'Notificación'
        verbose_name_plural = 'Notificaciones'
        ordering            = ['-id']
