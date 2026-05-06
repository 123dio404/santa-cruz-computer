from rest_framework import serializers
from .models import Venta, DetalleVenta, Pago
from apps.products.models import Producto


class PagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pago
        fields = ['id', 'monto', 'metodo', 'fecha']
        read_only_fields = ['id', 'fecha']


class DetalleVentaSerializer(serializers.ModelSerializer):
    producto_name = serializers.CharField(source='producto.name', read_only=True)
    
    class Meta:
        model = DetalleVenta
        fields = ['id', 'producto', 'producto_name', 'cantidad', 'precio_unitario', 'subtotal']


class DetalleVentaCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear detalles de venta"""
    class Meta:
        model = DetalleVenta
        fields = ['producto', 'cantidad', 'precio_unitario']


class VentaSerializer(serializers.ModelSerializer):
    detalles = DetalleVentaSerializer(many=True, read_only=True)
    pagos = PagoSerializer(many=True, read_only=True)
    cliente_name = serializers.CharField(source='cliente.name', read_only=True)
    vendedor_name = serializers.CharField(source='vendedor.name', read_only=True)
    
    class Meta:
        model = Venta
        fields = [
            'id', 'cliente', 'cliente_name', 'vendedor', 'vendedor_name',
            'total', 'status', 'fecha', 'detalles', 'pagos'
        ]
        read_only_fields = ['id', 'fecha']


class VentaCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear ventas con detalles"""
    detalles = DetalleVentaCreateSerializer(many=True, write_only=True)
    pagos = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)
    
    class Meta:
        model = Venta
        fields = ['cliente', 'vendedor', 'total', 'status', 'detalles', 'pagos']
    
    def create(self, validated_data):
        """
        Crear venta con detalles y actualizar stock
        """
        from django.utils import timezone
        from django.db import transaction
        
        detalles_data = validated_data.pop('detalles', [])
        pagos_data = validated_data.pop('pagos', [])
        
        validated_data['fecha'] = timezone.now()

        es_pedido_cliente = validated_data.get('vendedor') is None

        if es_pedido_cliente:
            # Pedido online del cliente → siempre pendiente, sin importar el método
            validated_data['status'] = 'pending'
        else:
            # Venta presencial hecha por un empleado
            metodo_pago = pagos_data[0].get('metodo') if pagos_data else None
            validated_data['status'] = 'completed' if metodo_pago == 'efectivo' else 'pending'
        
        with transaction.atomic():
            # Crear venta
            venta = Venta.objects.create(**validated_data)
            
            # Crear detalles y actualizar stock
            for detalle_data in detalles_data:
                producto = detalle_data['producto']
                cantidad = detalle_data['cantidad']
                
                # Validar stock disponible
                if producto.stock < cantidad:
                    raise serializers.ValidationError(
                        f"Stock insuficiente para {producto.name}. "
                        f"Disponible: {producto.stock}, Solicitado: {cantidad}"
                    )
                
                # Crear detalle de venta
                DetalleVenta.objects.create(
                    venta=venta,
                    producto=producto,
                    cantidad=cantidad,
                    precio_unitario=detalle_data['precio_unitario'],
                    subtotal=cantidad * detalle_data['precio_unitario']
                )
                
                # Actualizar stock (update_fields evita UPDATE completo en modelo managed=False)
                producto.stock -= cantidad
                producto.save(update_fields=['stock'])
            
            # Crear pagos
            for pago_data in pagos_data:
                Pago.objects.create(
                    venta=venta,
                    monto=pago_data.get('monto'),
                    metodo=pago_data.get('metodo'),
                    fecha=timezone.now()
                )
        
        return venta
