from django.db import models

ACCION_CHOICES = [
    ('LOGIN',    'Inicio de Sesión'),
    ('LOGOUT',   'Cierre de Sesión'),
    ('CREATE',   'Creación'),
    ('UPDATE',   'Actualización'),
    ('DELETE',   'Eliminación'),
    ('STOCK',    'Ajuste de Stock'),
    ('VENTA',    'Venta'),
    ('RESET_PW', 'Cambio de Contraseña'),
]


class Bitacora(models.Model):
    """
    Audit log table. managed=False → table created manually in PostgreSQL.
    No FK to auth_user — stores user info as plain fields from JWT claims.
    """
    usuario_id     = models.IntegerField(null=True, blank=True)
    usuario_nombre = models.CharField(max_length=100, blank=True, default='')
    usuario_rol    = models.CharField(max_length=20, blank=True, default='')
    accion         = models.CharField(max_length=30, choices=ACCION_CHOICES)
    modulo         = models.CharField(max_length=50)
    descripcion    = models.TextField()
    ip_address     = models.CharField(max_length=45, null=True, blank=True)
    fecha          = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed  = False
        db_table = 'bitacora'
        ordering = ['-fecha']
        verbose_name          = 'Registro de Bitácora'
        verbose_name_plural   = 'Registros de Bitácora'

    def __str__(self):
        return f"{self.accion} — {self.modulo} — {self.usuario_nombre}"
