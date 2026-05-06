from django.contrib import admin
from .models import Bitacora

@admin.register(Bitacora)
class BitacoraAdmin(admin.ModelAdmin):
    list_display  = ('usuario_nombre', 'usuario_rol', 'accion', 'modulo', 'fecha')
    list_filter   = ('accion', 'modulo', 'usuario_rol')
    search_fields = ('usuario_nombre', 'descripcion')
    readonly_fields = ('fecha',)
