from django.contrib import admin
from .models import Usuario, Cliente


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display  = ('id', 'username', 'nombre_completo', 'rol', 'activo')
    list_filter   = ('rol', 'activo')
    search_fields = ('username', 'nombre_completo')


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display  = ('id', 'nombre', 'apellido', 'correo', 'telefono', 'ciudad')
    search_fields = ('nombre', 'apellido', 'correo', 'usuario_login')
