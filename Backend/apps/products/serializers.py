"""
serializers.py — Serializers de Productos

Convierte modelos a JSON y valida datos entrantes del frontend.

NOTA IMPORTANTE sobre ProductoSerializer:
El frontend React envía campos con nombres distintos a los de la BD:
  - 'name'        → 'nombre'        (nombre del producto)
  - 'precio_venta'→ 'precio_actual' (precio de venta al público)
  - 'stock'       → 'stock_fisico'  (unidades disponibles)

to_internal_value() traduce esos nombres al formato de la BD antes de guardar.
to_representation() hace la traducción inversa al devolver datos al frontend.

NOTA sobre CompraCreateSerializer:
Django solo inserta filas. Los triggers de PostgreSQL se encargan de:
  · trg_sumar_stock_compra:     incrementar stock_fisico del producto
  · trg_actualizar_total_compra: actualizar monto_total de la compra
"""
from rest_framework import serializers
from .models import Categoria, Producto, Proveedor, Compra, DetalleCompra, Promocion


class PromocionSerializer(serializers.ModelSerializer):
    """Promoción de un producto (CU24), con precios calculados para la UI del admin."""
    producto_nombre    = serializers.SerializerMethodField()
    precio_normal      = serializers.SerializerMethodField()
    precio_promocional = serializers.SerializerMethodField()
    vigente            = serializers.SerializerMethodField()

    class Meta:
        model  = Promocion
        fields = ['id', 'producto', 'producto_nombre', 'porcentaje',
                  'fecha_inicio', 'fecha_fin', 'activo',
                  'precio_normal', 'precio_promocional', 'vigente']

    def get_producto_nombre(self, obj):
        return obj.producto.nombre if obj.producto else '—'

    def get_precio_normal(self, obj):
        return round(float(obj.producto.precio_actual or 0), 2) if obj.producto else 0

    def get_precio_promocional(self, obj):
        p = float(obj.producto.precio_actual or 0) if obj.producto else 0
        return round(p * (1 - float(obj.porcentaje) / 100), 2)

    def get_vigente(self, obj):
        from django.utils import timezone
        hoy = timezone.localdate()
        return bool(obj.activo and obj.fecha_inicio <= hoy <= obj.fecha_fin)


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model            = Categoria
        fields           = ['id', 'nombre']
        read_only_fields = ['id']


class ProductoSerializer(serializers.ModelSerializer):
    is_low_stock     = serializers.BooleanField(read_only=True)
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    # nombre es requerido en la BD, pero React lo envía como 'name' → se hace opcional
    # aquí y se rellena en to_internal_value antes de la validación
    nombre = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model  = Producto
        fields = [
            'id', 'categoria', 'categoria_nombre',
            'nombre', 'marca', 'modelo', 'imagen_url',
            'precio_compra', 'precio_actual',
            'stock_fisico', 'stock_minimo', 'is_low_stock',
            'descripcion', 'meses_garantia',
        ]
        read_only_fields = ['id']

    # ── Traducción entrada (React → modelo) ───────────────────────────────────
    def to_internal_value(self, data):
        # QueryDict (multipart) es inmutable; convertir a dict mutable.
        # Usamos dict() simple para textos; los archivos los inyectamos
        # directamente desde request.FILES para evitar que QueryDict.dict()
        # los convierta en strings.
        if hasattr(data, 'dict'):
            data = data.dict()
        else:
            data = dict(data)

        # Inyectar archivo de imagen desde request.FILES (multipart upload)
        request = self.context.get('request')
        if request is not None:
            for clave_archivo in ('imagen_url', 'imagen'):
                if clave_archivo in request.FILES:
                    data['imagen_url'] = request.FILES[clave_archivo]
                    break

        # name → nombre
        if 'name' in data:
            data.setdefault('nombre', data.pop('name'))

        # precio_venta → precio_actual (solo si tiene valor)
        if 'precio_venta' in data:
            v = data.pop('precio_venta')
            if v is not None and v != '':
                data.setdefault('precio_actual', v)

        # stock → stock_fisico
        if 'stock' in data:
            data.setdefault('stock_fisico', data.pop('stock'))

        # Descartar campos eliminados del esquema
        for campo in ('anio', 'estado', 'imagen', 'price', 'stock_actual'):
            data.pop(campo, None)

        return super().to_internal_value(data)

    # ── Alias de salida (modelo → React) ─────────────────────────────────────
    def to_representation(self, instance):
        rep = super().to_representation(instance)
        # imagen_url: DRF ImageField ya devuelve la URL absoluta si hay request
        # en el contexto. Si no, construir la URL manualmente.
        if instance.imagen_url:
            request = self.context.get('request')
            if request:
                rep['imagen_url'] = request.build_absolute_uri(instance.imagen_url.url)
            else:
                rep['imagen_url'] = f'/media/{instance.imagen_url}'
        else:
            rep['imagen_url'] = None

        # Aliases que React necesita leer
        rep['name']         = rep.get('nombre')
        rep['price']        = rep.get('precio_actual')
        rep['stock']        = rep.get('stock_fisico')
        rep['precio_venta'] = rep.get('precio_actual')

        # Promoción vigente hoy (CU24): precio con descuento si aplica
        from django.utils import timezone
        hoy = timezone.localdate()
        promo = Promocion.objects.filter(
            producto_id=instance.id, activo=True,
            fecha_inicio__lte=hoy, fecha_fin__gte=hoy,
        ).order_by('-porcentaje').first()
        if promo:
            precio = float(instance.precio_actual or 0)
            rep['promo_porcentaje']   = float(promo.porcentaje)
            rep['precio_promocional'] = round(precio * (1 - float(promo.porcentaje) / 100), 2)
        else:
            rep['promo_porcentaje']   = None
            rep['precio_promocional'] = None
        # Campos eliminados — devolver null para no romper el frontend
        rep['estado']       = None
        rep['anio']         = None
        rep['created_at']   = None
        return rep


class ProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Proveedor
        fields = [
            'id', 'nombre_empresa', 'nit', 'razon_social',
            'contacto_nombre', 'telefono', 'correo',
            'direccion', 'ciudad', 'activo', 'fecha_registro',
        ]
        read_only_fields = ['id', 'fecha_registro']


# --- Compra ---

class DetalleCompraSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_modelo = serializers.CharField(source='producto.modelo', read_only=True, allow_null=True)

    class Meta:
        model  = DetalleCompra
        fields = ['id', 'producto', 'producto_nombre', 'producto_modelo', 'cantidad', 'costo_unitario']


class DetalleCompraWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DetalleCompra
        fields = ['producto', 'cantidad', 'costo_unitario']


class CompraSerializer(serializers.ModelSerializer):
    detalles         = DetalleCompraSerializer(many=True, read_only=True)
    proveedor_nombre = serializers.CharField(source='proveedor.nombre_empresa', read_only=True)

    class Meta:
        model  = Compra
        fields = ['id', 'proveedor', 'proveedor_nombre', 'fecha_compra', 'monto_total', 'detalles']
        read_only_fields = ['id', 'fecha_compra', 'monto_total']


class CompraCreateSerializer(serializers.ModelSerializer):
    """
    POST /compras/ — Django solo inserta filas.
    Triggers encargados de:
      · sumar stock_fisico (trg_sumar_stock_compra)
      · actualizar monto_total en Compra (trg_actualizar_total_compra)
    """
    detalles = DetalleCompraWriteSerializer(many=True)

    class Meta:
        model  = Compra
        fields = ['proveedor', 'detalles']

    def create(self, validated_data):
        from django.db import transaction
        detalles_data = validated_data.pop('detalles', [])

        with transaction.atomic():
            compra = Compra.objects.create(**validated_data)
            for d in detalles_data:
                DetalleCompra.objects.create(compra=compra, **d)
            compra.refresh_from_db()

        return compra
