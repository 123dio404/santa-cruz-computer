from rest_framework import serializers
from .models import Usuario


class UsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, allow_null=True
    )
    username = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = Usuario
        fields = [
            'id', 'username', 'name', 'email', 'telefono',
            'fecha_nacimiento', 'ciudad',
            'role', 'activo', 'created_at', 'password',
        ]
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        if self.instance is None and not attrs.get('username'):
            raise serializers.ValidationError({'username': 'El nombre de usuario es requerido.'})
        return attrs

    def create(self, validated_data):
        from django.utils import timezone
        from django.contrib.auth.hashers import make_password

        password = validated_data.pop('password', None)
        validated_data.setdefault('created_at', timezone.now())
        usuario = super().create(validated_data)
        if password:
            usuario.password_hash = make_password(password)
            usuario.save(update_fields=['password_hash'])
        return usuario
