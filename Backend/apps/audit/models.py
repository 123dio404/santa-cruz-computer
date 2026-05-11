"""
models.py — Módulo de Auditoría (Bitácora)

Registra todas las acciones importantes del sistema para trazabilidad.

QUIÉN ESCRIBE EN LA BITÁCORA:
  Nunca el usuario directamente. Solo el sistema, a través de log_action()
  en apps/audit/utils.py, que es llamado desde los ViewSets de cada módulo.

TIPOS DE ACCIONES (AccionBitacora):
  LOGIN    → Inicio de sesión de un usuario
  LOGOUT   → Cierre de sesión
  CREATE   → Creación de un registro (producto, usuario, proveedor, etc.)
  UPDATE   → Modificación de un registro existente
  DELETE   → Eliminación de un registro
  STOCK    → Ajuste manual de stock de un producto
  VENTA    → Registro de una nueva venta
  COMPRA   → Registro de una compra a proveedor
  RESET_PW → Cambio de contraseña por recuperación OTP

DATOS GUARDADOS POR EVENTO:
  - usuario / usuario_nombre / usuario_rol: quién realizó la acción
  - accion / modulo / descripcion: qué se hizo y dónde
  - ip_address: desde qué IP se realizó (útil en auditorías de seguridad)
  - fecha: timestamp automático del momento de la acción

IMPORTANTE: managed = False — Django no gestiona esta tabla.
"""
from django.db import models


class AccionBitacora(models.TextChoices):
    LOGIN    = 'LOGIN',    'Inicio de Sesión'
    LOGOUT   = 'LOGOUT',  'Cierre de Sesión'
    CREATE   = 'CREATE',  'Creación'
    UPDATE   = 'UPDATE',  'Actualización'
    DELETE   = 'DELETE',  'Eliminación'
    STOCK    = 'STOCK',   'Ajuste de Stock'
    VENTA    = 'VENTA',   'Venta'
    COMPRA   = 'COMPRA',  'Compra'
    RESET_PW = 'RESET_PW','Cambio de Contraseña'


class Bitacora(models.Model):
    """Registro de auditoría. Cada fila representa una acción realizada en el sistema."""
    id             = models.AutoField(primary_key=True, db_column='idbitacora')
    usuario        = models.ForeignKey(
        'users.Usuario',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        db_column='idusuario',
        related_name='bitacoras',
    )
    usuario_nombre = models.CharField(max_length=100, default='')
    usuario_rol    = models.CharField(max_length=20, default='')
    accion         = models.CharField(max_length=30, choices=AccionBitacora.choices)
    modulo         = models.CharField(max_length=50)
    descripcion    = models.TextField()
    ip_address     = models.CharField(max_length=45, null=True, blank=True)
    fecha          = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed             = False
        db_table            = 'bitacora'
        ordering            = ['-fecha']
        verbose_name        = 'Registro de Bitácora'
        verbose_name_plural = 'Registros de Bitácora'

    def __str__(self):
        return f"{self.accion} — {self.modulo} — {self.usuario_nombre}"
