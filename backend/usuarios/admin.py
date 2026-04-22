from django.contrib import admin
from .models import Persona, Usuario, Cliente, Bitacora

# Esto hace que las tablas aparezcan en http://127.0.0.1:8000/admin/

@admin.register(Bitacora)
class BitacoraAdmin(admin.ModelAdmin):
    list_display = ('fecha_hora', 'usuario', 'username_intento', 'accion', 'ip_address')
    list_filter = ('accion', 'fecha_hora')
    search_fields = ('username_intento', 'usuario__username')

admin.site.register(Persona)
admin.site.register(Usuario)
admin.site.register(Cliente)