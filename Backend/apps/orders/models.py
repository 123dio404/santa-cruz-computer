"""
models.py — Módulo de Pedidos y Ventas

Define los modelos para el ciclo completo de una venta:
  Venta → DetalleVenta (productos) → PagoVenta (pagos) → Factura

FLUJO DE UNA VENTA:
1. Se crea la Venta (estado: 'pending')
2. Se insertan DetalleVenta (productos vendidos)
   → Trigger trg_validar_stock: verifica que haya stock suficiente
   → Trigger trg_gestionar_stock_venta: descuenta stock_fisico del Producto
   → Trigger trg_actualizar_total_venta: suma monto_total en Venta
3. Se insertan PagoVenta (pagos recibidos)
   → Trigger trg_actualizar_estado_venta: si pagos >= total y NO es pedido_online
     cambia estado a 'completed'

CAMPO ESPECIAL pedido_online:
  True  → Pedido del cliente desde la tienda web → queda en 'pending' (admin lo confirma)
  False → Venta presencial → se completa automáticamente si el pago cubre el total

IMPORTANTE: managed = False — Django no gestiona estas tablas.
"""
from django.db import models
from apps.users.models import Usuario, Cliente
from apps.products.models import Producto


class EstadoVenta(models.TextChoices):
    PENDING   = 'pending',   'Pendiente'
    COMPLETED = 'completed', 'Completada'


class EstadoEntrega(models.TextChoices):
    PENDIENTE = 'pendiente', 'Pendiente'
    ENTREGADO = 'entregado', 'Entregado'


class MetodoPago(models.TextChoices):
    QR            = 'qr',            'QR'
    TRANSFERENCIA = 'transferencia', 'Transferencia'
    EFECTIVO      = 'efectivo',      'Efectivo'
    TARJETA       = 'tarjeta',       'Tarjeta'


class EstadoSiat(models.TextChoices):
    PENDIENTE = 'PENDIENTE', 'Pendiente'
    ACEPTADO  = 'ACEPTADO',  'Aceptado'
    RECHAZADO = 'RECHAZADO', 'Rechazado'
    ANULADO   = 'ANULADO',   'Anulado'


class Venta(models.Model):
    """Cabecera de una venta. monto_total y estado son actualizados por triggers."""
    id             = models.AutoField(primary_key=True, db_column='idventa')
    cliente        = models.ForeignKey(
        Cliente,
        on_delete=models.DO_NOTHING,
        null=True, blank=True,
        db_column='idcliente',
        related_name='ventas',
    )
    usuario        = models.ForeignKey(
        Usuario,
        on_delete=models.DO_NOTHING,
        null=True, blank=True,
        db_column='idusuario',
        related_name='ventas',
    )
    fecha_venta    = models.DateTimeField(auto_now_add=True)
    # monto_total gestionado por trigger trg_actualizar_total_venta
    monto_total    = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # estado gestionado por trigger trg_actualizar_estado_venta (según pagos recibidos)
    estado         = models.CharField(
        max_length=20,
        choices=EstadoVenta.choices,
        default=EstadoVenta.PENDING,
    )
    estado_entrega = models.CharField(
        max_length=20,
        choices=EstadoEntrega.choices,
        default=EstadoEntrega.PENDIENTE,
    )
    pedido_online  = models.BooleanField(default=False)
    # Descuento VIP aplicado a esta venta (0 si el cliente no usó descuento)
    descuento_aplicado = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        managed             = False
        db_table            = 'venta'
        verbose_name        = 'Venta'
        verbose_name_plural = 'Ventas'
        ordering            = ['-fecha_venta']

    def __str__(self):
        return f"Venta #{self.id}"


class DetalleVenta(models.Model):
    """Ítem de una venta. Al insertarse, triggers descuentan stock y actualizan el total."""
    id              = models.AutoField(primary_key=True, db_column='iddetalle')
    venta           = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE,
        db_column='idventa',
        related_name='detalles',
    )
    producto        = models.ForeignKey(
        Producto,
        on_delete=models.DO_NOTHING,
        db_column='idproducto',
        related_name='detalles_venta',
    )
    cantidad        = models.IntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    # subtotal es GENERATED ALWAYS AS (cantidad * precio_unitario) STORED en PostgreSQL.
    # No se declara como campo Django para evitar incluirlo en INSERTs.

    @property
    def subtotal(self):
        return self.cantidad * self.precio_unitario

    class Meta:
        managed             = False
        db_table            = 'detalleventa'
        verbose_name        = 'Detalle de Venta'
        verbose_name_plural = 'Detalles de Venta'

    def __str__(self):
        return f"Detalle #{self.id} — Venta #{self.venta_id}"


class PagoVenta(models.Model):
    """Pago registrado para una venta. Al insertarse, un trigger puede completar la venta."""
    id     = models.AutoField(primary_key=True, db_column='idpagoventa')
    venta  = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE,
        db_column='idventa',
        related_name='pagos',
    )
    monto  = models.DecimalField(max_digits=10, decimal_places=2)
    metodo = models.CharField(max_length=20, choices=MetodoPago.choices)
    fecha  = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed             = False
        db_table            = 'pagoventa'
        verbose_name        = 'Pago de Venta'
        verbose_name_plural = 'Pagos de Venta'
        ordering            = ['-fecha']

    def __str__(self):
        return f"Pago {self.monto} Bs — Venta #{self.venta_id}"


class Factura(models.Model):
    id            = models.AutoField(primary_key=True, db_column='idfactura')
    venta         = models.OneToOneField(
        Venta,
        on_delete=models.DO_NOTHING,
        db_column='idventa',
        related_name='factura',
    )
    nro_factura   = models.BigIntegerField()
    cuf           = models.CharField(max_length=100)
    cufd          = models.CharField(max_length=100)
    estado_siat   = models.CharField(
        max_length=20,
        choices=EstadoSiat.choices,
        default=EstadoSiat.PENDIENTE,
    )
    fecha_emision = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed             = False
        db_table            = 'factura'
        verbose_name        = 'Factura'
        verbose_name_plural = 'Facturas'
        ordering            = ['-fecha_emision']

    def __str__(self):
        return f"Factura #{self.nro_factura} — Venta #{self.venta_id}"
