from rest_framework import serializers
from .models import Categoria, Producto


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'nombre']


class ProductoSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.SerializerMethodField()
    imagen_url   = serializers.ImageField(
        use_url=True,
        required=False,
        allow_null=True,
    )
    # Devuelve el nombre de la categoría en lecturas (GET)
    categoria_nombre = serializers.CharField(
        source='categoria.nombre',
        read_only=True,
    )

    class Meta:
        model  = Producto
        fields = [
            'id', 'name', 'marca', 'modelo', 'anio',
            'price', 'precio_compra', 'precio_venta',
            'stock', 'stock_minimo', 'estado', 'descripcion', 'imagen_url',
            'categoria', 'categoria_nombre',
            'is_low_stock', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_is_low_stock(self, obj):
        return obj.is_low_stock

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.imagen_url:
            request = self.context.get('request')
            if request:
                representation['imagen_url'] = request.build_absolute_uri(
                    instance.imagen_url.url
                )
            else:
                # Fallback: construye la URL sin objeto request
                from django.conf import settings
                base = getattr(settings, 'SITE_URL', 'http://localhost:8000')
                representation['imagen_url'] = f"{base}{instance.imagen_url.url}"
        return representation
