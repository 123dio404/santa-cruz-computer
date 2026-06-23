"""
serializers.py — Serializers de Usuarios

Los serializers convierten los modelos Django a JSON (para respuestas)
y validan/convierten el JSON entrante a datos del modelo (para guardar).

NOTA SOBRE ALIASES:
El frontend React usa nombres en inglés (name, role, etc.) pero la base de datos
usa nombres en español (nombre_completo, rol, etc.). Los serializers hacen la
traducción automáticamente en ambas direcciones.
"""
from rest_framework import serializers
from .models import Usuario, Cliente
from .password_rules import password_error_msg


class UsuarioSerializer(serializers.ModelSerializer):
    # write_only: la contraseña se acepta al crear/editar pero NUNCA se devuelve en respuestas
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)

    # Aliases de salida: el frontend espera 'name' y 'role', la BD tiene 'nombre_completo' y 'rol'
    name = serializers.CharField(source='nombre_completo', read_only=True)
    role = serializers.CharField(source='rol', read_only=True)

    class Meta:
        model  = Usuario
        fields = [
            'id', 'nombre_completo', 'username', 'rol', 'activo',
            'email', 'telefono', 'ciudad', 'fecha_nacimiento',
            'password',
            # compat aliases
            'name', 'role',
        ]
        read_only_fields = ['id']

    def to_internal_value(self, data):
        """Traduce los nombres de campos del frontend al formato de la base de datos."""
        if hasattr(data, 'dict'):
            data = data.dict()
        else:
            data = dict(data)

        # name (frontend) → nombre_completo (BD)
        if 'name' in data:
            data.setdefault('nombre_completo', data.pop('name'))

        # role (frontend) → rol (BD), con mapeo de valores en inglés a español
        if 'role' in data:
            val = data.pop('role')
            role_map = {
                'admin':    'admin',
                'employee': 'vendedor',
                'vendedor': 'vendedor',
                'client':   'cliente',
                'cliente':  'cliente',
            }
            data.setdefault('rol', role_map.get(str(val), val))

        # Eliminar campos que el frontend envía pero no existen en la tabla usuario
        for campo in ('created_at', 'lastName', 'gender', 'phone', 'birthDate', 'city'):
            data.pop(campo, None)

        return super().to_internal_value(data)

    def validate_username(self, value):
        # Excluir el propio registro al editar
        qs = Usuario.objects.filter(username=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Este nombre de usuario ya está en uso.')
        # Verificar también en la tabla de clientes (unicidad cruzada)
        if Cliente.objects.filter(usuario_login=value).exists():
            raise serializers.ValidationError('Este nombre de usuario ya está registrado como cliente.')
        return value

    def validate_password(self, value):
        # Solo valida si se envió una contraseña (en update puede venir vacía/ausente)
        if value:
            err = password_error_msg(value)
            if err:
                raise serializers.ValidationError(err)
        return value

    def validate_email(self, value):
        if not value:
            return value
        qs = Usuario.objects.filter(email=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Este email ya está en uso.')
        if Cliente.objects.filter(correo=value).exists():
            raise serializers.ValidationError('Este email ya está registrado como cliente.')
        return value

    def create(self, validated_data):
        """Crea un usuario y hashea la contraseña si se proporcionó."""
        from django.contrib.auth.hashers import make_password
        password = validated_data.pop('password', None)
        usuario  = super().create(validated_data)
        if password:
            usuario.password_hash = make_password(password)
            usuario.save(update_fields=['password_hash'])
        return usuario

    def update(self, instance, validated_data):
        """Actualiza un usuario y rehashea la contraseña solo si se envió una nueva."""
        from django.contrib.auth.hashers import make_password
        password = validated_data.pop('password', None)
        usuario  = super().update(instance, validated_data)
        if password:
            usuario.password_hash = make_password(password)
            usuario.save(update_fields=['password_hash'])
        return usuario


class ClienteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    # Flag calculado: VIP es cualquier cliente que alguna vez haya acumulado 10000 Bs
    es_vip = serializers.SerializerMethodField()

    def get_es_vip(self, obj):
        total = obj.total_acumulado or 0
        return bool(total and total >= 10000)

    class Meta:
        model  = Cliente
        fields = [
            'id', 'nombre', 'apellido', 'usuario_login', 'correo',
            'sexo', 'ciudad', 'telefono', 'fecha_nacimiento',
            'nit_ci', 'razon_social', 'password',
            'total_acumulado', 'descuento_disponible', 'es_vip',
        ]
        read_only_fields = ['id', 'total_acumulado', 'descuento_disponible', 'es_vip']

    def validate_usuario_login(self, value):
        if not value:
            return value
        qs = Cliente.objects.filter(usuario_login=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Este usuario login ya está en uso.')
        # Verificar también en la tabla de usuarios (unicidad cruzada)
        if Usuario.objects.filter(username=value).exists():
            raise serializers.ValidationError('Este usuario login ya está registrado como usuario del sistema.')
        return value

    def validate_password(self, value):
        if value:
            err = password_error_msg(value)
            if err:
                raise serializers.ValidationError(err)
        return value

    def validate_correo(self, value):
        if not value:
            return value
        qs = Cliente.objects.filter(correo=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Este correo ya está en uso.')
        if Usuario.objects.filter(email=value).exists():
            raise serializers.ValidationError('Este correo ya está registrado como usuario del sistema.')
        return value

    def create(self, validated_data):
        from django.contrib.auth.hashers import make_password
        raw = validated_data.pop('password', None)
        cliente = super().create(validated_data)
        if raw:
            cliente.password = make_password(raw)
            cliente.save(update_fields=['password'])
        return cliente

    def update(self, instance, validated_data):
        from django.contrib.auth.hashers import make_password
        raw = validated_data.pop('password', None)
        cliente = super().update(instance, validated_data)
        if raw:
            cliente.password = make_password(raw)
            cliente.save(update_fields=['password'])
        return cliente
