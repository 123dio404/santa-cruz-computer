from django.db import models


class OTPRecovery(models.Model):
    """OTP codes for password recovery. Table must be created manually in PostgreSQL."""
    usuario_id = models.IntegerField()
    email      = models.CharField(max_length=100)
    code       = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    used       = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed  = False
        db_table = 'otp_recovery'


# Auto-generated from inspectdb - Usuarios de la base de datos
class Usuario(models.Model):
    username        = models.CharField(unique=True, max_length=50, blank=True, null=True)
    name            = models.CharField(max_length=100)
    email           = models.CharField(unique=True, max_length=100)
    telefono        = models.CharField(max_length=20, blank=True, null=True)
    fecha_nacimiento= models.DateField(blank=True, null=True)
    ciudad          = models.CharField(max_length=100, blank=True, null=True)
    password_hash   = models.TextField(blank=True, null=True)
    role            = models.CharField(max_length=20, blank=True, null=True)
    activo          = models.BooleanField(default=True)
    created_at      = models.DateTimeField(auto_now_add=True, blank=True, null=True)

    # --- CAMPOS DE SEGURIDAD ADICIONALES ---
    intentos_fallidos = models.IntegerField(default=0)
    bloqueado_hasta   = models.DateTimeField(null=True, blank=True)
    token_recuperacion = models.CharField(max_length=100, null=True, blank=True)
    token_expiracion   = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = True # Cambiado a True para que Django pueda manejar estos campos
        db_table = 'usuario'
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def __str__(self):
        return self.name

    def es_bloqueado(self):
        from django.utils import timezone
        if self.bloqueado_hasta and self.bloqueado_hasta > timezone.now():
            return True
        return False
