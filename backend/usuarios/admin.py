from django.contrib import admin
from .models import Persona, Usuario, Cliente

# Esto hace que las tablas aparezcan en http://127.0.0.1:8000/admin/
admin.site.register(Persona)
admin.site.register(Usuario)
admin.site.register(Cliente)