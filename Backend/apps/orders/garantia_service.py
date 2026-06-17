"""
garantia_service.py — Lógica de generación de garantías.

Se usa en dos lugares:
  · VentaCreateSerializer.create  → genera garantías al registrar una venta nueva.
  · GarantiaViewSet.generar_retroactivas → genera las faltantes de ventas pasadas.

Regla: 1 garantía por cada ítem (DetalleVenta) cuyo producto tenga
meses_garantia > 0. La garantía cuenta desde la fecha de la venta.
"""
import calendar
from datetime import date
from django.utils import timezone


def add_months(d: date, months: int) -> date:
    """Suma 'months' meses a una fecha sin depender de dateutil.

    Ajusta el día al último día del mes destino si hace falta
    (ej: 31/01 + 1 mes → 28/02)."""
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    day = min(d.day, calendar.monthrange(y, m)[1])
    return date(y, m, day)


def crear_garantias_de_venta(venta) -> list:
    """Genera las garantías de una venta recién creada. Idempotente."""
    from .models import Garantia
    creadas = []
    inicio = (venta.fecha_venta or timezone.now()).date()
    for d in venta.detalles.select_related('producto').all():
        meses = getattr(d.producto, 'meses_garantia', 0) or 0
        if meses <= 0:
            continue
        if Garantia.objects.filter(detalle_id=d.id).exists():
            continue
        Garantia.objects.create(
            venta_id=venta.id, detalle_id=d.id, producto_id=d.producto_id,
            cliente_id=venta.cliente_id, cantidad=d.cantidad, meses=meses,
            fecha_inicio=inicio, fecha_fin=add_months(inicio, meses), estado='activa',
        )
        creadas.append(d.id)
    return creadas


def generar_garantias_faltantes() -> int:
    """Backfill: crea las garantías de todos los ítems de ventas pasadas que
    aún no tienen una (y cuyo producto tenga meses_garantia > 0).

    Cuenta desde la fecha real de cada venta, así una compra vieja puede salir
    ya vencida o con pocos meses restantes. Devuelve cuántas se crearon."""
    from .models import DetalleVenta, Garantia
    total = 0
    detalles = (DetalleVenta.objects
                .select_related('producto', 'venta')
                .filter(garantia__isnull=True))
    for d in detalles:
        meses = getattr(d.producto, 'meses_garantia', 0) or 0
        if meses <= 0:
            continue
        venta = d.venta
        inicio = (venta.fecha_venta or timezone.now()).date()
        Garantia.objects.create(
            venta_id=venta.id, detalle_id=d.id, producto_id=d.producto_id,
            cliente_id=venta.cliente_id, cantidad=d.cantidad, meses=meses,
            fecha_inicio=inicio, fecha_fin=add_months(inicio, meses), estado='activa',
        )
        total += 1
    return total
