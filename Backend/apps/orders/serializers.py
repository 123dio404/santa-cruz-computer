"""
serializers.py — Serializers del módulo de Ventas

Convierte modelos a JSON y valida datos entrantes del frontend.

SERIALIZERS DE LECTURA (GET):
  - PagoVentaSerializer:   Un pago individual de una venta
  - DetalleVentaSerializer: Un ítem de la venta (producto + cantidad + precio)
  - VentaSerializer:        Venta completa con detalles, pagos y datos del cliente
  - FacturaSerializer:      Factura fiscal de la venta

SERIALIZERS DE ESCRITURA (POST):
  - VentaCreateSerializer:  Crear venta con sus detalles y pagos en una sola petición
    Los triggers de PostgreSQL hacen el resto (stock, totales, estado)

ALIASES EN VentaSerializer:
  El frontend usa nombres en inglés, pero la BD usa español:
  - 'total'        → 'monto_total'
  - 'status'       → 'estado'
  - 'fecha'        → 'fecha_venta'
  - 'vendedor'     → 'usuario_id'
  - 'cliente_name' → calculado como nombre + apellido del cliente
"""
from rest_framework import serializers
from .models import Venta, DetalleVenta, PagoVenta, Factura


# ── Lectura ────────────────────────────────────────────────────────────────────

class PagoVentaSerializer(serializers.ModelSerializer):
    class Meta:
        model            = PagoVenta
        fields           = ['id', 'monto', 'metodo', 'fecha']
        read_only_fields = ['id', 'fecha']


class DetalleVentaSerializer(serializers.ModelSerializer):
    producto_nombre  = serializers.CharField(source='producto.nombre', read_only=True)
    subtotal         = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    producto_name    = serializers.CharField(source='producto.nombre', read_only=True)
    producto_imagen  = serializers.ImageField(source='producto.imagen_url', read_only=True)

    class Meta:
        model  = DetalleVenta
        fields = ['id', 'producto', 'producto_nombre', 'producto_name', 'producto_imagen', 'cantidad', 'precio_unitario', 'subtotal']


class VentaSerializer(serializers.ModelSerializer):
    detalles      = DetalleVentaSerializer(many=True, read_only=True)
    pagos         = PagoVentaSerializer(many=True, read_only=True)

    # Nombres completos — Cliente usa nombre+apellido, Usuario usa nombre_completo
    cliente_nombre = serializers.SerializerMethodField()
    usuario_nombre = serializers.CharField(source='usuario.nombre_completo', read_only=True, default=None)

    # ── Alias de compatibilidad (frontend usa estos nombres) ──────────────────
    total         = serializers.DecimalField(source='monto_total', max_digits=10, decimal_places=2, read_only=True)
    status        = serializers.CharField(source='estado', read_only=True)
    fecha         = serializers.DateTimeField(source='fecha_venta', read_only=True)
    cliente_name  = serializers.SerializerMethodField()
    vendedor      = serializers.IntegerField(source='usuario_id', read_only=True, default=None)
    vendedor_name = serializers.CharField(source='usuario.nombre_completo', read_only=True, default=None)

    def get_cliente_nombre(self, obj):
        if obj.cliente:
            return f"{obj.cliente.nombre} {obj.cliente.apellido}".strip()
        return None

    def get_cliente_name(self, obj):
        return self.get_cliente_nombre(obj)

    class Meta:
        model  = Venta
        fields = [
            'id', 'cliente', 'cliente_nombre',
            'usuario', 'usuario_nombre',
            'fecha_venta', 'monto_total', 'estado', 'estado_entrega',
            'detalles', 'pagos',
            # compat
            'total', 'status', 'fecha', 'cliente_name', 'vendedor', 'vendedor_name',
        ]
        read_only_fields = ['id', 'fecha_venta', 'monto_total']


class FacturaSerializer(serializers.ModelSerializer):
    class Meta:
        model            = Factura
        fields           = ['id', 'venta', 'nro_factura', 'cuf', 'cufd', 'estado_siat', 'fecha_emision']
        read_only_fields = ['id', 'fecha_emision']


# ── Escritura (POST) ────────────────────────────────────────────────────────────

class PagoVentaWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PagoVenta
        fields = ['monto', 'metodo']


class DetalleVentaWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DetalleVenta
        fields = ['producto', 'cantidad', 'precio_unitario']


class VentaCreateSerializer(serializers.ModelSerializer):
    """
    POST /ventas/ — Django solo inserta filas; los triggers hacen el resto:
      · trg_validar_stock       → valida stock antes de insertar DetalleVenta
      · trg_gestionar_stock_venta → descuenta stock_fisico
      · trg_actualizar_total_venta → suma monto_total en Venta
      · trg_actualizar_estado_venta → pasa estado a 'completed' cuando pagos >= total
    """
    detalles = DetalleVentaWriteSerializer(many=True)
    pagos    = PagoVentaWriteSerializer(many=True, required=False)

    class Meta:
        model  = Venta
        fields = ['cliente', 'usuario', 'estado_entrega', 'pedido_online', 'detalles', 'pagos']

    def create(self, validated_data):
        from django.db import transaction
        detalles_data = validated_data.pop('detalles', [])
        pagos_data    = validated_data.pop('pagos', [])

        with transaction.atomic():
            venta = Venta.objects.create(**validated_data)
            for d in detalles_data:
                DetalleVenta.objects.create(venta=venta, **d)
            for p in pagos_data:
                PagoVenta.objects.create(venta=venta, **p)
            # Refresca los campos actualizados por triggers (monto_total, estado)
            venta.refresh_from_db()

        return venta
