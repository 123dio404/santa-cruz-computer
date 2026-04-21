from django.db import models

class Proveedor(models.Model):
    id_proveedor = models.AutoField(primary_key=True)
    nombre_empresa = models.CharField(max_length=100, blank=True, null=True)
    nit = models.CharField(max_length=20, unique=True)

    class Meta:
        db_table = 'Proveedor'

class Producto(models.Model):
    ESTADO_CHOICES = [
        ('Nuevo', 'Nuevo'),
        ('Seminuevo', 'Seminuevo'),
        ('Usado', 'Usado'),
        ('Obsoleto', 'Obsoleto'),
    ]
    
    id_producto = models.AutoField(primary_key=True, db_column='IdProducto')
    nombre = models.CharField(max_length=150, db_column='Nombre')
    marca = models.CharField(max_length=50, blank=True, null=True)
    modelo = models.CharField(max_length=50, db_column='Modelo', blank=True, null=True)
    año = models.IntegerField(blank=True, null=True)
    precio_actual = models.DecimalField(max_digits=10, decimal_places=2, db_column='PrecioActual', blank=True, null=True)
    stock_fisico = models.IntegerField(default=0)
    stock_reservado = models.IntegerField(default=0)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, blank=True, null=True)

    class Meta:
        db_table = 'PRODUCTO'