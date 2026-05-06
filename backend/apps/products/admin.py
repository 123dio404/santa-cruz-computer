# -*- coding: utf-8 -*-
from django.contrib import admin
from .models import Producto

@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ('name', 'marca', 'modelo', 'price', 'stock', 'estado', 'created_at')
    list_filter = ('estado', 'created_at')
    search_fields = ('name', 'marca', 'modelo')
    readonly_fields = ('created_at',)
    fieldsets = (
        ('Informacion Basica', {
            'fields': ('name', 'marca', 'modelo', 'anio')
        }),
        ('Precio e Inventario', {
            'fields': ('price', 'stock')
        }),
        ('Estado', {
            'fields': ('estado', 'created_at')
        }),
    )
