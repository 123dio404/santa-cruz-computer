"""
models.py — Módulo de Productos

Define los modelos para el catálogo de la tienda y las compras a proveedores.

TABLAS:
- Categoria:    Clasificación de productos (ej: Laptops, Monitores)
- Producto:     Artículo del catálogo con precio, stock e imagen
- Proveedor:    Empresa que abastece los productos
- Compra:       Cabecera de una compra a un proveedor
- DetalleCompra: Ítems individuales de cada compra

TRIGGERS EN POSTGRESQL (gestionados por la BD, NO por Django):
- trg_sumar_stock_compra:       Al insertar DetalleCompra, incrementa stock_fisico del Producto
- trg_actualizar_total_compra:  Al insertar/modificar DetalleCompra, recalcula monto_total de Compra

IMPORTANTE: managed = False en todos los modelos.
Django NO crea ni migra estas tablas. Solo lee y escribe en ellas.
"""
from django.db import models


class Categoria(models.Model):
    """Categoría de productos (ej: Laptops, Periféricos, Monitores)."""
    id     = models.AutoField(primary_key=True, db_column='idcategoria')
    nombre = models.CharField(max_length=100)

    class Meta:
        managed             = False   # Django no gestiona esta tabla
        db_table            = 'categoria'
        verbose_name        = 'Categoría'
        verbose_name_plural = 'Categorías'

    def __str__(self):
        return self.nombre


class Producto(models.Model):
    """Artículo del catálogo. El stock es gestionado por triggers de PostgreSQL."""
    id            = models.AutoField(primary_key=True, db_column='idproducto')
    categoria     = models.ForeignKey(
        Categoria,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        db_column='idcategoria',
        related_name='productos',
    )
    nombre        = models.CharField(max_length=150)
    marca         = models.CharField(max_length=50, blank=True, null=True)
    modelo        = models.CharField(max_length=50, blank=True, null=True)
    imagen_url    = models.ImageField(upload_to='productos/', db_column='imagen_url', max_length=500, blank=True, null=True)
    precio_compra = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    precio_actual = models.DecimalField(max_digits=10, decimal_places=2)
    stock_fisico  = models.IntegerField(default=0)
    stock_minimo  = models.IntegerField(default=0)
    descripcion   = models.TextField(null=True, blank=True)
    # Duración de la garantía del producto en meses (0 = sin garantía).
    # La garantía de cada venta se cuenta desde la fecha de venta + estos meses.
    meses_garantia = models.IntegerField(default=0)

    class Meta:
        managed             = False
        db_table            = 'producto'
        verbose_name        = 'Producto'
        verbose_name_plural = 'Productos'

    def __str__(self):
        return self.nombre

    @property
    def is_low_stock(self):
        """True si el stock actual es igual o menor al stock mínimo configurado."""
        return self.stock_fisico <= self.stock_minimo


class Proveedor(models.Model):
    id              = models.AutoField(primary_key=True, db_column='idproveedor')
    nombre_empresa  = models.CharField(max_length=150)
    nit             = models.CharField(max_length=20, unique=True)
    razon_social    = models.CharField(max_length=150, null=True, blank=True)
    contacto_nombre = models.CharField(max_length=100, null=True, blank=True)
    telefono        = models.CharField(max_length=20,  null=True, blank=True)
    correo          = models.CharField(max_length=100, null=True, blank=True)
    direccion       = models.TextField(null=True, blank=True)
    ciudad          = models.CharField(max_length=50,  null=True, blank=True)
    activo          = models.BooleanField(default=True)
    fecha_registro  = models.DateTimeField(auto_now_add=True, editable=False)

    class Meta:
        managed             = False
        db_table            = 'proveedor'
        verbose_name        = 'Proveedor'
        verbose_name_plural = 'Proveedores'

    def __str__(self):
        return self.nombre_empresa


class Compra(models.Model):
    """Cabecera de una compra a un proveedor. El monto_total lo calcula un trigger."""
    id           = models.AutoField(primary_key=True, db_column='idcompra')
    proveedor    = models.ForeignKey(
        Proveedor,
        on_delete=models.DO_NOTHING,
        null=True, blank=True,
        db_column='idproveedor',
        related_name='compras',
    )
    fecha_compra = models.DateTimeField(auto_now_add=True)
    # monto_total es gestionado por trigger trg_actualizar_total_compra — solo lectura en Django
    monto_total  = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        managed             = False
        db_table            = 'compra'
        verbose_name        = 'Compra'
        verbose_name_plural = 'Compras'
        ordering            = ['-fecha_compra']

    def __str__(self):
        return f"Compra #{self.id}"


class DetalleCompra(models.Model):
    """Ítem individual de una compra. Al insertarse, un trigger suma stock al Producto."""
    id             = models.AutoField(primary_key=True, db_column='iddetallecompra')
    compra         = models.ForeignKey(
        Compra,
        on_delete=models.CASCADE,
        db_column='idcompra',
        related_name='detalles',
    )
    producto       = models.ForeignKey(
        Producto,
        on_delete=models.DO_NOTHING,
        db_column='idproducto',
        related_name='detalles_compra',
    )
    cantidad       = models.IntegerField()
    costo_unitario = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        managed             = False
        db_table            = 'detallecompra'
        verbose_name        = 'Detalle de Compra'
        verbose_name_plural = 'Detalles de Compra'

    def __str__(self):
        return f"Detalle #{self.id} — Compra #{self.compra_id}"
