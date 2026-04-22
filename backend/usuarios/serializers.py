from rest_framework import serializers
from .models import Usuario, Persona, Bitacora

class PersonaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Persona
        fields = ['nombre', 'correo', 'telefono']

class UsuarioSerializer(serializers.ModelSerializer):
    persona = PersonaSerializer()
    
    class Meta:
        model = Usuario
        fields = ['username', 'rol', 'activo', 'persona']

class BitacoraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bitacora
        fields = ['usuario', 'accion', 'fecha_hora', 'ip_address']
