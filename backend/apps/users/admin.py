# -*- coding: utf-8 -*-
from django.contrib import admin
from .models import Usuario

@admin.register(Usuario)
class UserAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'role', 'activo', 'created_at')
    list_filter = ('role', 'activo', 'created_at')
    search_fields = ('name', 'email')
    readonly_fields = ('created_at',)
    fieldsets = (
        ('Informacion Personal', {
            'fields': ('name', 'email', 'telefono')
        }),
        ('Acceso', {
            'fields': ('password_hash', 'activo', 'role')
        }),
        ('Marcas de Tiempo', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
