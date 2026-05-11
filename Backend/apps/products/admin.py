from django.contrib import admin
from .models import Categoria, Producto, Proveedor, Compra, DetalleCompra


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display  = ('id', 'nombre')
    search_fields = ('nombre',)


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display  = ('id', 'nombre', 'marca', 'modelo', 'precio_actual', 'stock_fisico', 'stock_minimo')
    list_filter   = ('categoria',)
    search_fields = ('nombre', 'marca', 'modelo')


@admin.register(Proveedor)
class ProveedorAdmin(admin.ModelAdmin):
    list_display  = ('id', 'nombre_empresa')
    search_fields = ('nombre_empresa',)


@admin.register(Compra)
class CompraAdmin(admin.ModelAdmin):
    list_display  = ('id', 'proveedor', 'monto_total', 'fecha_compra')
    list_filter   = ('fecha_compra',)
    readonly_fields = ('fecha_compra', 'monto_total')


@admin.register(DetalleCompra)
class DetalleCompraAdmin(admin.ModelAdmin):
    list_display = ('id', 'compra', 'producto', 'cantidad', 'costo_unitario')
