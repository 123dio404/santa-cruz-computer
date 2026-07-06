"""
models.py — Módulo de Pedidos y Ventas

Define los modelos para el ciclo completo de una venta:
  Venta → DetalleVenta (productos) → PagoVenta (pagos) → Factura

FLUJO DE UNA VENTA:
1. Se crea la Venta (estado: 'pending')
2. Se insertan DetalleVenta (productos vendidos)
   → Trigger trg_validar_stock: verifica que haya stock suficiente
   → Trigger trg_gestionar_stock_venta: descuenta stock_fisico del Producto
   → Trigger trg_actualizar_total_venta: suma monto_total en Venta
3. Se insertan PagoVenta (pagos recibidos)
   → Trigger trg_actualizar_estado_venta: si pagos >= total y NO es pedido_online
     cambia estado a 'completed'

CAMPO ESPECIAL pedido_online:
  True  → Pedido del cliente desde la tienda web → queda en 'pending' (admin lo confirma)
  False → Venta presencial → se completa automáticamente si el pago cubre el total

IMPORTANTE: managed = False — Django no gestiona estas tablas.
"""
from django.db import models
from apps.users.models import Usuario, Cliente
from apps.products.models import Producto


class EstadoVenta(models.TextChoices):
    PENDING   = 'pending',   'Pendiente'
    COMPLETED = 'completed', 'Completada'


class EstadoEntrega(models.TextChoices):
    PENDIENTE = 'pendiente', 'Pendiente'
    ENTREGADO = 'entregado', 'Entregado'


class MetodoPago(models.TextChoices):
    QR            = 'qr',            'QR'
    TRANSFERENCIA = 'transferencia', 'Transferencia'
    EFECTIVO      = 'efectivo',      'Efectivo'
    TARJETA       = 'tarjeta',       'Tarjeta'


class EstadoSiat(models.TextChoices):
    PENDIENTE = 'PENDIENTE', 'Pendiente'
    ACEPTADO  = 'ACEPTADO',  'Aceptado'
    RECHAZADO = 'RECHAZADO', 'Rechazado'
    ANULADO   = 'ANULADO',   'Anulado'


class Venta(models.Model):
    """Cabecera de una venta. monto_total y estado son actualizados por triggers."""
    id             = models.AutoField(primary_key=True, db_column='idventa')
    cliente        = models.ForeignKey(
        Cliente,
        on_delete=models.DO_NOTHING,
        null=True, blank=True,
        db_column='idcliente',
        related_name='ventas',
    )
    usuario        = models.ForeignKey(
        Usuario,
        on_delete=models.DO_NOTHING,
        null=True, blank=True,
        db_column='idusuario',
        related_name='ventas',
    )
    fecha_venta    = models.DateTimeField(auto_now_add=True)
    # monto_total gestionado por trigger trg_actualizar_total_venta
    monto_total    = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # estado gestionado por trigger trg_actualizar_estado_venta (según pagos recibidos)
    estado         = models.CharField(
        max_length=20,
        choices=EstadoVenta.choices,
        default=EstadoVenta.PENDING,
    )
    estado_entrega = models.CharField(
        max_length=20,
        choices=EstadoEntrega.choices,
        default=EstadoEntrega.PENDIENTE,
    )
    pedido_online  = models.BooleanField(default=False)
    # Descuento VIP aplicado a esta venta (0 si el cliente no usó descuento)
    descuento_aplicado = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        managed             = False
        db_table            = 'venta'
        verbose_name        = 'Venta'
        verbose_name_plural = 'Ventas'
        ordering            = ['-fecha_venta']

    def __str__(self):
        return f"Venta #{self.id}"


class DetalleVenta(models.Model):
    """Ítem de una venta. Al insertarse, triggers descuentan stock y actualizan el total."""
    id              = models.AutoField(primary_key=True, db_column='iddetalle')
    venta           = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE,
        db_column='idventa',
        related_name='detalles',
    )
    producto        = models.ForeignKey(
        Producto,
        on_delete=models.DO_NOTHING,
        db_column='idproducto',
        related_name='detalles_venta',
    )
    cantidad        = models.IntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    # subtotal es GENERATED ALWAYS AS (cantidad * precio_unitario) STORED en PostgreSQL.
    # No se declara como campo Django para evitar incluirlo en INSERTs.

    @property
    def subtotal(self):
        return self.cantidad * self.precio_unitario

    class Meta:
        managed             = False
        db_table            = 'detalleventa'
        verbose_name        = 'Detalle de Venta'
        verbose_name_plural = 'Detalles de Venta'

    def __str__(self):
        return f"Detalle #{self.id} — Venta #{self.venta_id}"


class PagoVenta(models.Model):
    """Pago registrado para una venta. Al insertarse, un trigger puede completar la venta."""
    id     = models.AutoField(primary_key=True, db_column='idpagoventa')
    venta  = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE,
        db_column='idventa',
        related_name='pagos',
    )
    monto  = models.DecimalField(max_digits=10, decimal_places=2)
    metodo = models.CharField(max_length=20, choices=MetodoPago.choices)
    fecha  = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed             = False
        db_table            = 'pagoventa'
        verbose_name        = 'Pago de Venta'
        verbose_name_plural = 'Pagos de Venta'
        ordering            = ['-fecha']

    def __str__(self):
        return f"Pago {self.monto} Bs — Venta #{self.venta_id}"


class Factura(models.Model):
    id            = models.AutoField(primary_key=True, db_column='idfactura')
    venta         = models.OneToOneField(
        Venta,
        on_delete=models.DO_NOTHING,
        db_column='idventa',
        related_name='factura',
    )
    nro_factura   = models.BigIntegerField()
    cuf           = models.CharField(max_length=100)
    cufd          = models.CharField(max_length=100)
    estado_siat   = models.CharField(
        max_length=20,
        choices=EstadoSiat.choices,
        default=EstadoSiat.PENDIENTE,
    )
    fecha_emision = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed             = False
        db_table            = 'factura'
        verbose_name        = 'Factura'
        verbose_name_plural = 'Facturas'
        ordering            = ['-fecha_emision']

    def __str__(self):
        return f"Factura #{self.nro_factura} — Venta #{self.venta_id}"


class EstadoGarantia(models.TextChoices):
    ACTIVA    = 'activa',    'Activa'        # vigente o vencida (se calcula por fecha)
    RECLAMADA = 'reclamada', 'Reclamada'     # el cliente reportó un problema
    APROBADA  = 'aprobada',  'Aprobada'      # el reclamo procede (se cubre)
    RECHAZADA = 'rechazada', 'Rechazada'     # no procede (manipulación/mal uso)


class Garantia(models.Model):
    """
    Garantía de un producto vendido (una por ítem de la venta).

    La garantía nace al CREAR la venta: fecha_inicio = fecha_venta y
    fecha_fin = fecha_inicio + producto.meses_garantia. El estado 'vencida'
    NO se guarda: se deriva comparando fecha_fin con la fecha actual.
    Solo se persisten los estados explícitos (activa/reclamada/aprobada/rechazada).
    """
    id               = models.AutoField(primary_key=True, db_column='idgarantia')
    venta            = models.ForeignKey(
        Venta, on_delete=models.CASCADE, db_column='idventa', related_name='garantias',
    )
    detalle          = models.OneToOneField(
        DetalleVenta, on_delete=models.CASCADE, db_column='iddetalle', related_name='garantia',
    )
    producto         = models.ForeignKey(
        Producto, on_delete=models.DO_NOTHING, db_column='idproducto', related_name='garantias',
    )
    cliente          = models.ForeignKey(
        Cliente, on_delete=models.DO_NOTHING, null=True, blank=True,
        db_column='idcliente', related_name='garantias',
    )
    cantidad         = models.IntegerField(default=1)
    meses            = models.IntegerField(default=0)
    fecha_inicio     = models.DateField()
    fecha_fin        = models.DateField()
    estado           = models.CharField(
        max_length=20, choices=EstadoGarantia.choices, default=EstadoGarantia.ACTIVA,
    )
    motivo_reclamo   = models.TextField(null=True, blank=True)
    fecha_reclamo    = models.DateTimeField(null=True, blank=True)
    resolucion       = models.TextField(null=True, blank=True)
    fecha_resolucion = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed             = False
        db_table            = 'garantia'
        verbose_name        = 'Garantía'
        verbose_name_plural = 'Garantías'
        ordering            = ['-id']

    def __str__(self):
        return f"Garantía #{self.id} — Venta #{self.venta_id}"


class EstadoResena(models.TextChoices):
    VISIBLE = 'visible', 'Visible'
    OCULTO  = 'oculto',  'Oculto'


class Resena(models.Model):
    """
    Reseña de una venta completa (opinión de la tienda: atención + producto).

    1 por venta (UNIQUE), solo de ventas completadas del propio cliente.
    Una vez creada es fija (no se edita ni borra por el cliente). El admin
    puede ocultarla (estado='oculto') sin perder el registro.
    """
    id          = models.AutoField(primary_key=True, db_column='idresena')
    venta       = models.OneToOneField(
        Venta, on_delete=models.CASCADE, db_column='idventa', related_name='resena',
    )
    cliente     = models.ForeignKey(
        Cliente, on_delete=models.CASCADE, db_column='idcliente', related_name='resenas',
    )
    puntuacion  = models.SmallIntegerField()
    comentario  = models.TextField(null=True, blank=True)
    estado      = models.CharField(
        max_length=20, choices=EstadoResena.choices, default=EstadoResena.VISIBLE,
    )
    fecha       = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed             = False
        db_table            = 'resena'
        verbose_name        = 'Reseña'
        verbose_name_plural = 'Reseñas'
        ordering            = ['-id']

    def __str__(self):
        return f"Reseña #{self.id} — Venta #{self.venta_id} ({self.puntuacion}★)"


class Devolucion(models.Model):
    """
    Devolución (RMA) de un ítem de una venta (CU23). La registra el vendedor/admin
    en el mostrador; nace 'aprobada' o 'rechazada'. El stock del producto vuelve
    (por trigger) SOLO si es 'aprobada'. NO toca detalleventa/factura/pagoventa.
    Tabla creada por SQL manual (managed=False): 005_devoluciones.sql
    """
    id              = models.AutoField(primary_key=True, db_column='iddevolucion')
    venta           = models.ForeignKey(
        Venta, on_delete=models.DO_NOTHING, db_column='idventa', related_name='devoluciones',
    )
    detalle         = models.ForeignKey(
        DetalleVenta, on_delete=models.DO_NOTHING, db_column='iddetalle', related_name='devoluciones',
    )
    producto        = models.ForeignKey(
        Producto, on_delete=models.DO_NOTHING, db_column='idproducto', related_name='devoluciones',
    )
    cliente         = models.ForeignKey(
        Cliente, on_delete=models.DO_NOTHING, null=True, blank=True,
        db_column='idcliente', related_name='devoluciones',
    )
    cantidad        = models.IntegerField(default=1)
    motivo          = models.TextField()
    estado          = models.CharField(max_length=20, default='aprobada')   # aprobada | rechazada
    motivo_rechazo  = models.TextField(null=True, blank=True)
    monto_reembolso = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    usuario         = models.ForeignKey(
        Usuario, on_delete=models.DO_NOTHING, null=True, blank=True,
        db_column='idusuario', related_name='devoluciones_registradas',
    )
    fecha           = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed             = False
        db_table            = 'devolucion'
        verbose_name        = 'Devolución'
        verbose_name_plural = 'Devoluciones'
        ordering            = ['-id']

    def __str__(self):
        return f"Devolución #{self.id} — Venta #{self.venta_id} ({self.estado})"


# ── Servicio Técnico (CU25/26/27) ────────────────────────────────────────────
class ServicioCatalogo(models.Model):
    """Catálogo de servicios técnicos con su precio (007_servicios_tecnicos.sql)."""
    id      = models.AutoField(primary_key=True, db_column='idservicio')
    nombre  = models.CharField(max_length=150)
    tipo    = models.CharField(max_length=20)                          # preventivo | correctivo
    equipo  = models.CharField(max_length=20, null=True, blank=True)   # laptop | escritorio (solo preventivo)
    precio  = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    activo  = models.BooleanField(default=True)

    class Meta:
        managed  = False
        db_table = 'servicio_catalogo'
        ordering = ['id']


class OrdenServicio(models.Model):
    """Orden de servicio técnico. La registra y ejecuta el técnico (crea + atiende)."""
    id                 = models.AutoField(primary_key=True, db_column='idorden')
    cliente            = models.ForeignKey(
        Cliente, on_delete=models.DO_NOTHING, null=True, blank=True,
        db_column='idcliente', related_name='ordenes_servicio')
    tecnico            = models.ForeignKey(
        Usuario, on_delete=models.DO_NOTHING, null=True, blank=True,
        db_column='idtecnico', related_name='ordenes_servicio')
    garantia           = models.ForeignKey(
        Garantia, on_delete=models.DO_NOTHING, null=True, blank=True,
        db_column='idgarantia', related_name='ordenes_servicio')
    tipo               = models.CharField(max_length=20)                     # preventivo | correctivo
    origen             = models.CharField(max_length=20, default='externo')  # tienda | externo
    equipo             = models.CharField(max_length=20, default='laptop')   # laptop | escritorio
    equipo_descripcion = models.CharField(max_length=200, null=True, blank=True)
    es_beneficio       = models.BooleanField(default=False)
    diagnostico        = models.TextField(null=True, blank=True)
    observaciones      = models.TextField(null=True, blank=True)
    costo_total        = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    estado             = models.CharField(max_length=20, default='solicitado')
    fecha_solicitud    = models.DateTimeField(auto_now_add=True)
    fecha_agendada     = models.DateTimeField(null=True, blank=True)
    fecha_finalizacion = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed  = False
        db_table = 'orden_servicio'
        ordering = ['-id']


class OrdenDetalle(models.Model):
    """Servicios incluidos en una orden (el correctivo puede llevar varios)."""
    id       = models.AutoField(primary_key=True, db_column='iddetorden')
    orden    = models.ForeignKey(OrdenServicio, on_delete=models.CASCADE, db_column='idorden', related_name='detalles')
    servicio = models.ForeignKey(ServicioCatalogo, on_delete=models.DO_NOTHING, db_column='idservicio', related_name='detalles')
    precio   = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        managed  = False
        db_table = 'orden_detalle'


class TareaServicio(models.Model):
    """Checklist de tareas de una orden (sobre todo del preventivo)."""
    id        = models.AutoField(primary_key=True, db_column='idtarea')
    orden     = models.ForeignKey(OrdenServicio, on_delete=models.CASCADE, db_column='idorden', related_name='tareas')
    tarea     = models.CharField(max_length=150)
    realizado = models.BooleanField(default=False)

    class Meta:
        managed  = False
        db_table = 'tarea_servicio'
        ordering = ['id']


# ── Venta a crédito / Cartera (CU28/CU29) ────────────────────────────────────
class PlanCredito(models.Model):
    """
    Plan de financiamiento POR PRODUCTO (cuelga del detalle de la venta).
    El cálculo (recargo, inicial, cuotas, mora) lo hace el backend.
    Tabla creada por SQL manual (managed=False): 009_credito.sql
    """
    id                = models.AutoField(primary_key=True, db_column='idplan')
    venta             = models.ForeignKey(
        Venta, on_delete=models.DO_NOTHING, db_column='idventa', related_name='planes_credito')
    detalle           = models.ForeignKey(
        DetalleVenta, on_delete=models.DO_NOTHING, db_column='iddetalle', related_name='planes_credito')
    producto          = models.ForeignKey(
        Producto, on_delete=models.DO_NOTHING, db_column='idproducto', related_name='planes_credito')
    cliente           = models.ForeignKey(
        Cliente, on_delete=models.DO_NOTHING, null=True, blank=True,
        db_column='idcliente', related_name='planes_credito')
    usuario           = models.ForeignKey(
        Usuario, on_delete=models.DO_NOTHING, null=True, blank=True,
        db_column='idusuario', related_name='planes_credito_registrados')
    precio_unitario   = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cantidad          = models.IntegerField(default=1)
    precio_base       = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    recargo_pct       = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    precio_financiado = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    inicial           = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    n_cuotas          = models.IntegerField(default=6)
    monto_cuota       = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    saldo             = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    estado            = models.CharField(max_length=20, default='vigente')  # vigente | pagado | moroso
    fecha             = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed  = False
        db_table = 'plan_credito'
        ordering = ['-id']

    def __str__(self):
        return f"Plan #{self.id} — Venta #{self.venta_id} ({self.estado})"


class Cuota(models.Model):
    """Cuota mensual de un plan de crédito (calendario de pagos)."""
    id                = models.AutoField(primary_key=True, db_column='idcuota')
    plan              = models.ForeignKey(
        PlanCredito, on_delete=models.CASCADE, db_column='idplan', related_name='cuotas')
    numero            = models.IntegerField()
    monto             = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    mora              = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    fecha_vencimiento = models.DateField()
    fecha_pago        = models.DateTimeField(null=True, blank=True)
    estado            = models.CharField(max_length=20, default='pendiente')  # pendiente | pagada | vencida
    usuario_cobro     = models.ForeignKey(
        Usuario, on_delete=models.DO_NOTHING, null=True, blank=True,
        db_column='idusuario_cobro', related_name='cuotas_cobradas')

    class Meta:
        managed  = False
        db_table = 'cuota'
        ordering = ['numero']

    def __str__(self):
        return f"Cuota {self.numero} — Plan #{self.plan_id} ({self.estado})"
