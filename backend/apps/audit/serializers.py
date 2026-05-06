from rest_framework import serializers
from .models import Bitacora


class BitacoraSerializer(serializers.ModelSerializer):
    accion_display = serializers.CharField(source='get_accion_display', read_only=True)

    class Meta:
        model  = Bitacora
        fields = [
            'id', 'usuario_id', 'usuario_nombre', 'usuario_rol',
            'accion', 'accion_display', 'modulo', 'descripcion',
            'ip_address', 'fecha',
        ]
