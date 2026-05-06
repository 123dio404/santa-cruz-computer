# -*- coding: utf-8 -*-
from django.contrib import admin
from .models import Venta, DetalleVenta, Pago

@admin.register(Venta)
class VentaAdmin(admin.ModelAdmin):
    list_display = ('id', 'cliente', 'vendedor', 'total', 'status', 'fecha')
    list_filter = ('status', 'fecha')
    search_fields = ('cliente__name', 'vendedor__name')
    readonly_fields = ('fecha',)
    fieldsets = (
        ('Informacion de Venta', {
            'fields': ('cliente', 'vendedor', 'status')
        }),
        ('Monto', {
            'fields': ('total',)
        }),
        ('Fecha', {
            'fields': ('fecha',)
        }),
    )

@admin.register(DetalleVenta)
class DetalleVentaAdmin(admin.ModelAdmin):
    list_display = ('id', 'venta', 'producto', 'cantidad', 'precio_unitario', 'subtotal')
    list_filter = ('venta', 'producto')
    search_fields = ('venta__id', 'producto__name')
    readonly_fields = ()

@admin.register(Pago)
class PagoAdmin(admin.ModelAdmin):
    list_display = ('id', 'venta', 'monto', 'metodo', 'fecha')
    list_filter = ('metodo', 'fecha')
    search_fields = ('venta__id',)
    readonly_fields = ('fecha',)
