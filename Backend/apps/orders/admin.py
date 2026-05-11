from django.contrib import admin
from .models import Venta, DetalleVenta, PagoVenta, Factura


@admin.register(Venta)
class VentaAdmin(admin.ModelAdmin):
    list_display  = ('id', 'cliente', 'usuario', 'monto_total', 'estado', 'estado_entrega', 'fecha_venta')
    list_filter   = ('estado', 'estado_entrega', 'fecha_venta')
    readonly_fields = ('fecha_venta', 'monto_total', 'estado')


@admin.register(DetalleVenta)
class DetalleVentaAdmin(admin.ModelAdmin):
    list_display = ('id', 'venta', 'producto', 'cantidad', 'precio_unitario')


@admin.register(PagoVenta)
class PagoVentaAdmin(admin.ModelAdmin):
    list_display = ('id', 'venta', 'monto', 'metodo', 'fecha')
    list_filter  = ('metodo',)
    readonly_fields = ('fecha',)


@admin.register(Factura)
class FacturaAdmin(admin.ModelAdmin):
    list_display = ('id', 'nro_factura', 'venta', 'estado_siat', 'fecha_emision')
    list_filter  = ('estado_siat',)
    readonly_fields = ('fecha_emision',)
