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
from .models import Venta, DetalleVenta, PagoVenta, Factura, Garantia


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
            'detalles', 'pagos', 'descuento_aplicado',
            # compat
            'total', 'status', 'fecha', 'cliente_name', 'vendedor', 'vendedor_name',
        ]
        read_only_fields = ['id', 'fecha_venta', 'monto_total', 'descuento_aplicado']


class FacturaSerializer(serializers.ModelSerializer):
    class Meta:
        model            = Factura
        fields           = ['id', 'venta', 'nro_factura', 'cuf', 'cufd', 'estado_siat', 'fecha_emision']
        read_only_fields = ['id', 'fecha_emision']


class GarantiaSerializer(serializers.ModelSerializer):
    """Lectura de garantías. 'vencida' NO está en BD: se calcula por fecha."""
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_imagen = serializers.ImageField(source='producto.imagen_url', read_only=True)
    cliente_nombre  = serializers.SerializerMethodField()
    estado_efectivo = serializers.SerializerMethodField()  # vigente|vencida|reclamada|aprobada|rechazada
    vigente         = serializers.SerializerMethodField()  # se puede reclamar
    dias_restantes  = serializers.SerializerMethodField()
    venta_estado    = serializers.CharField(source='venta.estado', read_only=True)

    class Meta:
        model  = Garantia
        fields = [
            'id', 'venta', 'detalle', 'producto', 'producto_nombre', 'producto_imagen',
            'cliente', 'cliente_nombre', 'cantidad', 'meses',
            'fecha_inicio', 'fecha_fin', 'estado', 'estado_efectivo', 'vigente',
            'dias_restantes', 'motivo_reclamo', 'fecha_reclamo',
            'resolucion', 'fecha_resolucion', 'venta_estado',
        ]

    def _hoy(self):
        from django.utils import timezone
        return timezone.localdate()

    def get_cliente_nombre(self, obj):
        if obj.cliente:
            return f"{obj.cliente.nombre} {obj.cliente.apellido}".strip()
        return None

    def get_estado_efectivo(self, obj):
        if obj.estado == 'activa':
            return 'vigente' if obj.fecha_fin >= self._hoy() else 'vencida'
        return obj.estado

    def get_vigente(self, obj):
        return obj.estado == 'activa' and obj.fecha_fin >= self._hoy()

    def get_dias_restantes(self, obj):
        return max((obj.fecha_fin - self._hoy()).days, 0)


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

    DESCUENTO VIP:
      Después de que el trigger calcula monto_total, si el cliente tiene
      descuento_disponible, se aplica en bloques de 200 Bs (tantos como
      caben en la compra). Luego se actualiza el acumulado del cliente y
      se otorgan nuevos bonos si cruzo un umbral de 10000 Bs.
    """
    detalles = DetalleVentaWriteSerializer(many=True)
    pagos    = PagoVentaWriteSerializer(many=True, required=False)
    # Opcional: el frontend puede mandar aplicar_descuento_vip=False para guardar el bono
    aplicar_descuento_vip = serializers.BooleanField(write_only=True, required=False, default=True)

    class Meta:
        model  = Venta
        fields = ['cliente', 'usuario', 'estado_entrega', 'pedido_online',
                  'detalles', 'pagos', 'aplicar_descuento_vip']

    def create(self, validated_data):
        from django.db import transaction
        from decimal import Decimal
        from apps.users.models import Cliente

        detalles_data = validated_data.pop('detalles', [])
        pagos_data    = validated_data.pop('pagos', [])
        aplicar       = validated_data.pop('aplicar_descuento_vip', True)

        with transaction.atomic():
            venta = Venta.objects.create(**validated_data)
            for d in detalles_data:
                DetalleVenta.objects.create(venta=venta, **d)

            # Los triggers ya actualizaron monto_total. Refrescamos para leerlo.
            venta.refresh_from_db()
            original_total = venta.monto_total or Decimal('0')

            # Lógica de descuento VIP (solo si hay cliente)
            if venta.cliente_id:
                cliente = Cliente.objects.select_for_update().get(pk=venta.cliente_id)

                descuento_aplicado = Decimal('0')
                if aplicar and cliente.descuento_disponible and original_total > 0:
                    # Bloques de 200 disponibles vs los que caben en la compra (relajado: ≤)
                    blocks_available    = int(cliente.descuento_disponible) // 200
                    blocks_in_purchase  = int(original_total) // 200
                    blocks_to_apply     = min(blocks_available, blocks_in_purchase)
                    descuento_aplicado  = Decimal(blocks_to_apply * 200)

                if descuento_aplicado > 0:
                    # Reducir monto_total y registrar el descuento (no dispara trigger)
                    Venta.objects.filter(pk=venta.pk).update(
                        monto_total=original_total - descuento_aplicado,
                        descuento_aplicado=descuento_aplicado,
                    )
                    cliente.descuento_disponible = cliente.descuento_disponible - descuento_aplicado

                # Acumular el monto ANTES del descuento (premio a la lealtad real)
                previo = cliente.total_acumulado or Decimal('0')
                cliente.total_acumulado = previo + original_total

                # Otorgar nuevos bonos por cada umbral de 10000 cruzado
                prev_thresholds = int(previo) // 10000
                new_thresholds  = int(cliente.total_acumulado) // 10000
                new_bonuses     = new_thresholds - prev_thresholds
                if new_bonuses > 0:
                    cliente.descuento_disponible = (
                        (cliente.descuento_disponible or Decimal('0')) + Decimal(new_bonuses * 200)
                    )

                cliente.save(update_fields=['total_acumulado', 'descuento_disponible'])

            # Crear pagos al final: el trigger ahora compara contra el monto descontado
            for p in pagos_data:
                PagoVenta.objects.create(venta=venta, **p)

            # Generar garantías de los productos vendidos (1 por ítem con meses_garantia > 0)
            from .garantia_service import crear_garantias_de_venta
            crear_garantias_de_venta(venta)

            venta.refresh_from_db()

        return venta
