from django.db import models
from usuarios.models import Cliente, Usuario
from inventario.models import Producto

class Reserva(models.Model):
    ESTADO_RESERVA = [('Activa', 'Activa'), ('Atendida', 'Atendida'), ('Cancelada', 'Cancelada')]
    id_reserva = models.AutoField(primary_key=True, db_column='IdReserva')
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, db_column='IdCliente')
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='IdUsuario')
    fecha_reserva = models.DateTimeField(auto_now_add=True, db_column='FechaReserva')
    fecha_vencimiento = models.DateTimeField(db_column='FechaVencimiento')
    monto_adelanto = models.DecimalField(max_digits=10, decimal_places=2, default=0, db_column='MontoAdelanto')
    estado = models.CharField(max_length=20, choices=ESTADO_RESERVA, default='Activa', db_column='Estado')

    class Meta:
        db_table = 'Reserva'

class Venta(models.Model):
    id_venta = models.AutoField(primary_key=True, db_column='IdVenta')
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, db_column='IdCliente')
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='IdUsuario')
    reserva = models.ForeignKey(Reserva, on_delete=models.SET_NULL, null=True, blank=True, db_column='IdReserva')
    fecha_venta = models.DateTimeField(auto_now_add=True, db_column='FechaVenta')
    total_venta = models.DecimalField(max_digits=10, decimal_places=2, db_column='TotalVenta')

    class Meta:
        db_table = 'VENTA'

class DetalleVenta(models.Model):
    id_detalle = models.AutoField(primary_key=True, db_column='IdDetalle')
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, db_column='IdVenta')
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, db_column='IdProducto')
    cantidad = models.IntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2, db_column='PrecioUnitario')
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, db_column='Subtotal')

    class Meta:
        db_table = 'DETALLEVENTA'