"""
serializers.py — Serializer de Auditoría

BitacoraSerializer convierte registros de la bitácora a JSON para el frontend.

CAMPO EXTRA accion_display:
  Además del código de acción ('LOGIN', 'CREATE', etc.), se devuelve
  'accion_display' con el texto legible en español ('Inicio de Sesión', 'Creación', etc.)
  usando el método get_accion_display() que generan automáticamente los TextChoices.
"""
from rest_framework import serializers
from .models import Bitacora


class BitacoraSerializer(serializers.ModelSerializer):
    """Solo lectura — la bitácora no se modifica desde el frontend."""
    accion_display = serializers.CharField(source='get_accion_display', read_only=True)

    class Meta:
        model  = Bitacora
        fields = [
            'id', 'usuario_id', 'usuario_nombre', 'usuario_rol',
            'accion', 'accion_display', 'modulo', 'descripcion',
            'ip_address', 'fecha',
        ]
