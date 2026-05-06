from django.db import models
from apps.users.models import Usuario
from apps.products.models import Producto

# Auto-generated from inspectdb - Ventas
class Venta(models.Model):
    cliente = models.ForeignKey(Usuario, models.DO_NOTHING, blank=True, null=True, related_name='ventas_cliente')
    vendedor = models.ForeignKey(Usuario, models.DO_NOTHING, blank=True, null=True, related_name='ventas_vendedor')
    total = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    status = models.CharField(max_length=20, blank=True, null=True)
    fecha = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'venta'
        verbose_name = 'Venta'
        verbose_name_plural = 'Ventas'
        ordering = ['-fecha']

    def __str__(self):
        return f"Venta {self.id} - {self.cliente}"


class DetalleVenta(models.Model):
    venta = models.ForeignKey(Venta, models.DO_NOTHING, blank=True, null=True, related_name='detalles')
    producto = models.ForeignKey(Producto, models.DO_NOTHING, blank=True, null=True)
    cantidad = models.IntegerField(blank=True, null=True)
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'detalle_venta'
        verbose_name = 'Detalle de Venta'
        verbose_name_plural = 'Detalles de Venta'

    def __str__(self):
        return f"Detalle - {self.venta.id}"


class Pago(models.Model):
    venta = models.ForeignKey(Venta, models.DO_NOTHING, blank=True, null=True, related_name='pagos')
    monto = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    metodo = models.CharField(max_length=20, blank=True, null=True)
    fecha = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'pago'
        verbose_name = 'Pago'
        verbose_name_plural = 'Pagos'
        ordering = ['-fecha']

    def __str__(self):
        return f"Pago {self.monto} - {self.venta.id}"
