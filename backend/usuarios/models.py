from django.db import models
from django.utils import timezone

class Persona(models.Model):
    id_persona = models.AutoField(primary_key=True, db_column='IdPersona')
    nombre = models.CharField(max_length=100)
    correo = models.EmailField(max_length=100, unique=True)
    telefono = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        db_table = 'Persona'

class Usuario(models.Model):
    # Alineado perfectamente con lo que espera tu frontend
    ROL_CHOICES = [
        ('admin', 'Administrador'),
        ('employee', 'Empleado / Vendedor'),
        ('client', 'Cliente'),
    ]

    persona = models.OneToOneField(Persona, on_delete=models.CASCADE, primary_key=True, db_column='idUsuario')
    username = models.CharField(max_length=50, unique=True, null=True) # Añadido para login
    rol = models.CharField(max_length=50, choices=ROL_CHOICES)
    activo = models.BooleanField(default=True)
    password_hash = models.TextField(blank=True, null=True)

    # Campos de Seguridad y Bloqueo
    intentos_fallidos = models.IntegerField(default=0)
    bloqueado_hasta = models.DateTimeField(null=True, blank=True)

    # Recuperación de Contraseña
    token_recuperacion = models.CharField(max_length=100, null=True, blank=True)
    token_expiracion = models.DateTimeField(null=True, blank=True)

    def es_bloqueado(self):
        if self.bloqueado_hasta and self.bloqueado_hasta > timezone.now():
            return True
        return False

    class Meta:
        db_table = 'Usuario'

class Bitacora(models.Model):
    ACCION_CHOICES = [
        ('login', 'Inicio de Sesión'),
        ('logout', 'Cierre de Sesión'),
        ('failed_login', 'Intento Fallido'),
        ('password_change', 'Cambio de Contraseña'),
    ]

    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, null=True, blank=True)
    username_intento = models.CharField(max_length=50, null=True, blank=True) # Para registrar intentos aunque el usuario no exista
    accion = models.CharField(max_length=50, choices=ACCION_CHOICES)
    fecha_hora = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = 'Bitacora'
        ordering = ['-fecha_hora']

class Cliente(models.Model):
    persona = models.OneToOneField(Persona, on_delete=models.CASCADE, primary_key=True, db_column='IdCliente')
    nit = models.CharField(max_length=20, unique=True)

    class Meta:
        db_table = 'Cliente'