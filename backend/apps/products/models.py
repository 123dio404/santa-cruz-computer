from django.db import models


class Categoria(models.Model):
    nombre = models.CharField(max_length=100)

    class Meta:
        managed = False
        db_table = 'categoria'
        verbose_name = 'Categoría'
        verbose_name_plural = 'Categorías'

    def __str__(self):
        return self.nombre


class Producto(models.Model):
    name          = models.CharField(max_length=150)
    marca         = models.CharField(max_length=50, blank=True, null=True)
    modelo        = models.CharField(max_length=50, blank=True, null=True)
    anio          = models.IntegerField(blank=True, null=True)
    price         = models.DecimalField(max_digits=10, decimal_places=2)
    precio_compra = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    precio_venta  = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    stock         = models.IntegerField(blank=True, null=True)
    stock_minimo  = models.IntegerField(default=0)
    estado        = models.CharField(max_length=20, blank=True, null=True)
    descripcion   = models.TextField(blank=True, null=True)
    imagen_url    = models.ImageField(
        upload_to='productos/',
        blank=True,
        null=True,
        db_column='imagen_url',
    )
    categoria     = models.ForeignKey(
        Categoria,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='categoria_id',
    )
    created_at    = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'producto'
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def is_low_stock(self):
        if self.stock is None:
            return False
        return self.stock <= self.stock_minimo
