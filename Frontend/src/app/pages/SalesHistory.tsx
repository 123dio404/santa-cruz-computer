/**
 * SalesHistory.tsx - Historial de Ventas (Admin y Vendedor)
 *
 * Página central de gestión de ventas para admin y empleados.
 * Muestra todas las ventas del sistema con distintas vistas (tabs).
 *
 * TABS DISPONIBLES:
 * - Todas:       Lista completa de ventas
 * - Completadas: Solo ventas con status 'completed'
 * - Pendientes:  Solo ventas con status 'pending' (pedidos online sin confirmar)
 * - Clientes:    Vista por cliente — selecciona un cliente y ve sus compras
 *
 * ACCIONES DISPONIBLES:
 * - "Confirmar Entrega": Marca una venta pendiente como completada (admin/vendedor)
 * - "Descargar Factura": Genera y descarga PDF de la factura (ventas completadas)
 *
 * ESTADÍSTICAS (solo admin):
 * - Total de ventas, monto total, promedio por venta
 * - Recaudado por método de pago (efectivo, QR, tarjeta)
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Package, DollarSign, Clock, ChevronDown, ChevronUp, CheckCircle, Banknote, CreditCard, QrCode, Users, Eye, ArrowLeft, FileText, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { ventasAPI, clientesAPI, devolucionesAPI, API_BASE_URL, ApiCliente, ApiVenta } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { exportToExcel } from '../utils/exportExcel';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface VentaDetail {
  id: number;
  cliente: number;
  cliente_name: string;
  vendedor: number;
  vendedor_name: string;
  total: number;
  status: string;
  fecha: string;
  detalles: Array<{
    id: number;
    producto_name: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
  pagos: Array<{
    id: number;
    monto: number;
    metodo: string;
    fecha: string;
  }>;
}

interface HistorialData {
  total_ventas: number;
  total_monto: number;
  ventas: VentaDetail[];
}

type Filtro = 'todas' | 'completadas' | 'pendientes' | 'clientes';

export function SalesHistory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canComplete = user?.role === 'admin' || user?.role === 'employee';
  const [searchParams] = useSearchParams();

  const [historialData, setHistorialData] = useState<HistorialData | null>(null);
  const [devolucionesReporte, setDevolucionesReporte] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedVenta, setExpandedVenta] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<Filtro>(
    (searchParams.get('filtro') as Filtro) ?? 'todas'
  );
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Estado SOLO para reportes (no afecta la visualizacion de las cards)
  const [repDesde, setRepDesde] = useState('');
  const [repHasta, setRepHasta] = useState('');
  const [repVendedor, setRepVendedor] = useState<string>(''); // '', 'online' o id en string

  // Client tab state
  const [clienteFiltrado, setClienteFiltrado] = useState<ApiCliente | null>(null);
  const [clientVentas, setClientVentas] = useState<ApiVenta[]>([]);
  const [loadingClientVentas, setLoadingClientVentas] = useState(false);
  const [expandedClientVenta, setExpandedClientVenta] = useState<number | null>(null);
  const [apiClientes, setApiClientes] = useState<ApiCliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);

  // Devoluciones (CU23)
  const [devVenta, setDevVenta]                 = useState<ApiVenta | null>(null);
  const [devDetalleId, setDevDetalleId]         = useState<number | ''>('');
  const [devCantidad, setDevCantidad]           = useState(1);
  const [devMotivo, setDevMotivo]               = useState('');
  const [devInsp, setDevInsp]                   = useState({ sinDano: false, mismo: false, completo: false });
  const [devMotivoRechazo, setDevMotivoRechazo] = useState('');
  const [devLoading, setDevLoading]             = useState(false);
  const [devMsg, setDevMsg]                     = useState<{ ok: boolean; text: string } | null>(null);
  useEscapeKey(!!devVenta, () => setDevVenta(null));

  useEffect(() => {
    if (user) cargarHistorial();
  }, [user]);

  useEffect(() => {
    if (filtro === 'clientes') {
      setLoadingClientes(true);
      clientesAPI.getAll()
        .then(setApiClientes)
        .catch(() => setApiClientes([]))
        .finally(() => setLoadingClientes(false));
    }
  }, [filtro]);

  // Carga todas las ventas del backend y calcula el total acumulado
  const cargarHistorial = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setLoadError(null);
      const ventas = await ventasAPI.getAll() as unknown as VentaDetail[];
      const total_monto = ventas.reduce((s, v) => s + (Number(v.total) || 0), 0);
      setHistorialData({ total_ventas: ventas.length, total_monto, ventas });
      devolucionesAPI.list().then(setDevolucionesReporte).catch(() => {});
    } catch (error) {
      console.error('Error cargando historial:', error);
      setLoadError(error instanceof Error ? error.message : 'Error al cargar ventas');
    } finally {
      setLoading(false);
    }
  };

  // Marca una venta pendiente como entregada/completada y recarga la lista
  const handleConfirmarEntrega = async (ventaId: number) => {
    setUpdatingId(ventaId);
    try {
      await ventasAPI.confirmarEntrega(ventaId);
      await cargarHistorial();
    } catch (error) {
      console.error('Error confirmando entrega:', error);
      alert('Error al confirmar la entrega');
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Devoluciones (CU23) ──────────────────────────────────────────────────────
  // Solo se puede devolver dentro de los 7 días desde la compra
  const dentroPlazoDevolucion = (fecha: string) =>
    (Date.now() - new Date(fecha).getTime()) <= 7 * 86400000;

  // Unidades disponibles para devolver de un detalle: total menos lo ya procesado
  // (aprobada o rechazada). Una devolución rechazada también consume porque la
  // decisión es final: ese ítem ya fue evaluado y no se puede reintentar.
  const unidadesDisponiblesDetalle = (detalleId: number, cantidadTotal: number) => {
    const yaProcesado = devolucionesReporte
      .filter((d: any) => d.detalle === detalleId && (d.estado === 'aprobada' || d.estado === 'rechazada'))
      .reduce((s: number, d: any) => s + (Number(d.cantidad) || 0), 0);
    return Math.max(0, cantidadTotal - yaProcesado);
  };

  // Detalles de una venta que aún tienen unidades por devolver
  const detallesPendientes = (v: ApiVenta) =>
    (v.detalles ?? []).filter(d => unidadesDisponiblesDetalle(d.id, d.cantidad) > 0);

  const abrirDevolucion = (v: ApiVenta) => {
    if (!dentroPlazoDevolucion(v.fecha)) {
      alert('Fuera de plazo: la venta tiene más de 7 días. No se puede registrar una devolución.');
      return;
    }
    const pendientes = detallesPendientes(v);
    if (pendientes.length === 0) {
      alert('Todos los ítems de esta venta ya fueron procesados (aprobados o rechazados).');
      return;
    }
    setDevVenta(v);
    setDevDetalleId(pendientes.length === 1 ? pendientes[0].id : '');
    setDevCantidad(1);
    setDevMotivo('');
    setDevInsp({ sinDano: false, mismo: false, completo: false });
    setDevMotivoRechazo('');
    setDevMsg(null);
  };

  const submitDevolucion = async (aprobar: boolean) => {
    if (!devDetalleId) { setDevMsg({ ok: false, text: 'Elige el producto a devolver.' }); return; }
    if (!devMotivo.trim()) { setDevMsg({ ok: false, text: 'Indica el motivo de la devolución.' }); return; }
    // Para APROBAR es obligatorio confirmar la inspección física (responsabilidad del trabajador)
    if (aprobar && !(devInsp.sinDano && devInsp.mismo && devInsp.completo)) {
      setDevMsg({ ok: false, text: 'Para APROBAR debes confirmar los 3 puntos de la inspección física.' });
      return;
    }
    if (!aprobar && !devMotivoRechazo.trim()) { setDevMsg({ ok: false, text: 'Indica el motivo del rechazo.' }); return; }
    setDevLoading(true);
    setDevMsg(null);
    try {
      await devolucionesAPI.crear({
        detalle: Number(devDetalleId), cantidad: devCantidad, motivo: devMotivo.trim(),
        aprobar, motivo_rechazo: aprobar ? undefined : devMotivoRechazo.trim(),
      });
      setDevMsg({ ok: true, text: aprobar ? '✅ Devolución aprobada. Stock reingresado.' : 'Devolución rechazada registrada.' });
      await cargarHistorial();
      setTimeout(() => setDevVenta(null), 1400);
    } catch (e) {
      setDevMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo registrar la devolución.' });
    } finally {
      setDevLoading(false);
    }
  };

  // Carga las ventas de un cliente específico para mostrar en la tab "Clientes"
  const handleVerCompras = async (client: ApiCliente) => {
    setClienteFiltrado(client);
    setLoadingClientVentas(true);
    try {
      const v = await ventasAPI.getByCliente(client.id);
      setClientVentas(v);
    } catch {
      setClientVentas([]);
    } finally {
      setLoadingClientVentas(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; classes: string }> = {
      completed: { label: 'Completada', classes: 'bg-green-100 text-green-800' },
      pending:   { label: 'Pendiente',  classes: 'bg-yellow-100 text-yellow-800' },
    };
    const s = map[status] ?? { label: status, classes: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium mr-4 ${s.classes}`}>
        {s.label}
      </span>
    );
  };

  const formatMetodo = (metodo: string) => {
    if (metodo === 'efectivo') return 'Efectivo';
    if (metodo === 'tarjeta')  return 'Tarjeta';
    if (metodo === 'transferencia') return 'QR / Transferencia';
    return metodo;
  };

  const getUltimaCompra = (clienteId: number): string => {
    if (!historialData) return '—';
    const ventasCliente = historialData.ventas
      .filter(v => v.cliente === clienteId)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    if (ventasCliente.length === 0) return 'Sin compras';
    return new Date(ventasCliente[0].fecha).toLocaleDateString('es-BO');
  };

  const nombreCliente = (c: ApiCliente) =>
    [c.nombre, c.apellido].filter(Boolean).join(' ') || '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando historial de ventas...</p>
        </div>
      </div>
    );
  }

  const tabs: { key: Filtro; label: string; activeClass: string }[] = [
    { key: 'todas',       label: 'Todas',       activeClass: 'bg-blue-600 text-white' },
    { key: 'completadas', label: 'Completadas',  activeClass: 'bg-green-600 text-white' },
    { key: 'pendientes',  label: 'Pendientes',   activeClass: 'bg-yellow-600 text-white' },
    { key: 'clientes',    label: 'Clientes',     activeClass: 'bg-purple-600 text-white' },
  ];

  const ventasFiltradas = (historialData?.ventas ?? []).filter(venta => {
    if (filtro === 'todas')       return true;
    if (filtro === 'completadas') return venta.status === 'completed';
    if (filtro === 'pendientes')  return venta.status === 'pending';
    return true;
  });

  const totalEfectivo      = (historialData?.ventas ?? []).reduce((s, v) => s + v.pagos.filter(p => p.metodo === 'efectivo').reduce((a, p) => a + (Number(p.monto) || 0), 0), 0);
  const totalTarjeta       = (historialData?.ventas ?? []).reduce((s, v) => s + v.pagos.filter(p => p.metodo === 'tarjeta').reduce((a, p) => a + (Number(p.monto) || 0), 0), 0);
  const totalTransferencia = (historialData?.ventas ?? []).reduce((s, v) => s + v.pagos.filter(p => p.metodo === 'transferencia').reduce((a, p) => a + (Number(p.monto) || 0), 0), 0);

  // Lista unica de vendedores presentes en las ventas (excluye pedidos online)
  const vendedoresUnicos = (() => {
    const map = new Map<number, string>();
    (historialData?.ventas ?? []).forEach(v => {
      if (v.vendedor && v.vendedor_name) map.set(v.vendedor, v.vendedor_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  })();

  // ── Ventas para el reporte (tab activa + rango de fechas + vendedor) ───────
  const ventasReporte = ventasFiltradas.filter(v => {
    const fecha = new Date(v.fecha);
    const desde = repDesde ? new Date(repDesde) : null;
    const hasta = repHasta ? new Date(repHasta + 'T23:59:59') : null;
    const okFecha = (!desde || fecha >= desde) && (!hasta || fecha <= hasta);

    let okVend = true;
    if (repVendedor === 'online') okVend = !v.vendedor;
    else if (repVendedor !== '') okVend = v.vendedor === Number(repVendedor);

    return okFecha && okVend;
  });

  const totalGeneralReporte = ventasReporte.reduce((s, v) => s + (Number(v.total) || 0), 0);

  // Devoluciones aprobadas → ítems devueltos (para marcar "Devuelta") y ventas netas
  const returnedDetalleIds = new Set(
    devolucionesReporte.filter((d: any) => d.estado === 'aprobada').map((d: any) => d.detalle)
  );
  const totalDevoluciones = devolucionesReporte
    .filter((d: any) => d.estado === 'aprobada')
    .reduce((s: number, d: any) => s + (Number(d.monto_reembolso) || 0), 0);
  const totalNetoReporte = totalGeneralReporte - totalDevoluciones;

  const formatRangoFechas = () => {
    if (repDesde && repHasta) return `Del ${repDesde} al ${repHasta}`;
    if (repDesde) return `Desde ${repDesde}`;
    if (repHasta) return `Hasta ${repHasta}`;
    return 'Todas las fechas';
  };

  const vendedorReporteNombre = repVendedor === ''
    ? 'Todos'
    : repVendedor === 'online'
      ? 'Pedidos online'
      : (vendedoresUnicos.find(x => x.id === Number(repVendedor))?.name ?? '—');

  const tipoReporte =
    filtro === 'completadas' ? 'Ventas Completadas' :
    filtro === 'pendientes' ? 'Ventas Pendientes' :
    'Todas las Ventas';

  // ── Exportar a Excel (.xlsx) ────────────────────────────────────────────────
  const descargarExcel = () => {
    if (ventasReporte.length === 0) return;
    const headers = [
      '# Venta', 'Cliente', 'Vendedor', 'Fecha', 'Estado',
      'Producto', 'Cantidad', 'Precio Unit. (Bs)', 'Subtotal (Bs)',
    ];

    const rows: (string | number)[][] = [];
    ventasReporte.forEach(v => {
      const fecha = new Date(v.fecha).toLocaleDateString('es-BO');
      const estado = v.status === 'completed' ? 'Completada'
        : v.status === 'pending' ? 'Pendiente'
        : v.status;
      const detalles = v.detalles ?? [];

      if (detalles.length === 0) {
        rows.push([`#${v.id}`, v.cliente_name || 'General', v.vendedor_name || 'Pedido online',
                   fecha, estado, '(sin detalle)', '', '', '']);
      } else {
        detalles.forEach(d => {
          const precio = Number(d.precio_unitario);
          const estadoLinea = returnedDetalleIds.has(d.id) ? 'Devuelta' : estado;
          rows.push([
            `#${v.id}`,
            v.cliente_name || 'General',
            v.vendedor_name || 'Pedido online',
            fecha,
            estadoLinea,
            d.producto_name,
            d.cantidad,
            Number(precio.toFixed(2)),
            Number((Number(d.subtotal) || 0).toFixed(2)),
          ]);
        });
      }
    });

    // Resumen: bruto − devoluciones = neto
    rows.push(['', '', '', '', '', '', '', 'TOTAL BRUTO (Bs)', Number(totalGeneralReporte.toFixed(2))]);
    if (totalDevoluciones > 0) {
      rows.push(['', '', '', '', '', '', '', 'DEVOLUCIONES (Bs)', -Number(totalDevoluciones.toFixed(2))]);
      rows.push(['', '', '', '', '', '', '', 'VENTAS NETAS (Bs)', Number(totalNetoReporte.toFixed(2))]);
    }

    exportToExcel({
      filename: `reporte_ventas_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Ventas',
      headers,
      rows,
    });
  };

  // ── Exportar a PDF (descarga automática + vista previa) vía jsPDF ────────────
  const descargarPDF = async () => {
    if (ventasReporte.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Logo opcional: si no carga, el PDF se genera igual sin él
    const logo = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/logo.png';
    });

    const primerNombre = (s: string) => s.trim().split(/\s+/)[0] || s.trim();
    const estadoLabel = (st: string) =>
      st === 'completed' ? 'Completada' : st === 'pending' ? 'Pendiente' : st;

    // Una fila por línea de producto (el # Venta se repite)
    const body: string[][] = [];
    ventasReporte.forEach(v => {
      const fecha = new Date(v.fecha).toLocaleDateString('es-BO');
      const estado = estadoLabel(v.status);
      const cliente = v.cliente_name ? primerNombre(v.cliente_name) : 'General';
      const vendedor = v.vendedor_name ? primerNombre(v.vendedor_name) : 'Online';
      const detalles = v.detalles ?? [];
      if (detalles.length === 0) {
        body.push([`#${v.id}`, fecha, cliente, vendedor, estado, '(sin detalle)', '', '', '']);
      } else {
        detalles.forEach(d => body.push([
          `#${v.id}`, fecha, cliente, vendedor,
          returnedDetalleIds.has(d.id) ? 'Devuelta' : estado,
          d.producto_name,
          String(d.cantidad),
          (Number(d.precio_unitario) || 0).toFixed(2),
          (Number(d.subtotal) || 0).toFixed(2),
        ]));
      }
    });

    // Pie: bruto − devoluciones = neto
    const foot: any[] = [
      [{ content: 'TOTAL BRUTO', colSpan: 8, styles: { halign: 'right' } },
       { content: `Bs ${totalGeneralReporte.toFixed(2)}`, styles: { halign: 'right' } }],
    ];
    if (totalDevoluciones > 0) {
      foot.push([{ content: 'Devoluciones', colSpan: 8, styles: { halign: 'right' } },
                 { content: `- Bs ${totalDevoluciones.toFixed(2)}`, styles: { halign: 'right' } }]);
      foot.push([{ content: 'VENTAS NETAS', colSpan: 8, styles: { halign: 'right' } },
                 { content: `Bs ${totalNetoReporte.toFixed(2)}`, styles: { halign: 'right' } }]);
    }

    const now = new Date();

    autoTable(doc, {
      startY: 92,
      margin: { top: 92, left: 24, right: 24, bottom: 34 },
      head: [['# Venta', 'Fecha', 'Cliente', 'Vendedor', 'Estado', 'Producto', 'Cant.', 'P. Unit. (Bs)', 'Subtotal (Bs)']],
      body,
      foot,
      showFoot: 'lastPage',
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      footStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 10 },
      alternateRowStyles: { fillColor: [243, 244, 246] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 42 },
        1: { halign: 'center', cellWidth: 58 },
        2: { cellWidth: 78 },
        3: { cellWidth: 78 },
        4: { halign: 'center', cellWidth: 62 },
        5: { cellWidth: 'auto' },
        6: { halign: 'center', cellWidth: 38 },
        7: { halign: 'right', cellWidth: 66 },
        8: { halign: 'right', cellWidth: 72 },
      },
      // Encabezado dibujado en CADA página
      didDrawPage: () => {
        if (logo) {
          try { doc.addImage(logo, 'PNG', 24, 16, 40, 40); } catch { /* logo opcional */ }
        }
        const xText = logo ? 72 : 24;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(30, 64, 175);
        doc.text('SANTA CRUZ - COMPUTER', xText, 30);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
        doc.text('Santa Cruz de la Sierra', xText, 44);
        doc.setFontSize(9); doc.setTextColor(70);
        doc.text(`Fecha: ${now.toLocaleDateString('es-BO')}`, pageWidth - 24, 26, { align: 'right' });
        doc.text(`Hora: ${now.toLocaleTimeString('es-BO')}`, pageWidth - 24, 40, { align: 'right' });
        doc.setDrawColor(30, 64, 175); doc.setLineWidth(1.5);
        doc.line(24, 54, pageWidth - 24, 54);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(30, 64, 175);
        doc.text('REPORTE DE VENTAS', pageWidth / 2, 72, { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90);
        doc.text(
          `${formatRangoFechas()}  ·  ${tipoReporte}  ·  Vendedor: ${vendedorReporteNombre}  ·  ${ventasReporte.length} ventas`,
          pageWidth / 2, 84, { align: 'center' },
        );
      },
    });

    // Pie con número de página en cada hoja
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(130);
      doc.text('Documento generado automáticamente desde el sistema', 24, pageHeight - 16);
      doc.text(`Pág: ${i} de ${totalPages}`, pageWidth - 24, pageHeight - 16, { align: 'right' });
    }

    const filename = `reporte_ventas_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);                             // descarga automática
    window.open(doc.output('bloburl'), '_blank');   // vista previa en pestaña
  };

  // ── Reporte de devoluciones (CU23) ──────────────────────────────────────────
  const devolucionesFiltradas = () => devolucionesReporte.filter((d: any) => {
    const f = new Date(d.fecha);
    if (repDesde && f < new Date(repDesde + 'T00:00:00')) return false;
    if (repHasta && f > new Date(repHasta + 'T23:59:59')) return false;
    return true;
  });

  const motivoDev = (d: any) => (d.estado === 'rechazada' ? (d.motivo_rechazo || d.motivo) : d.motivo) || '—';

  const descargarDevExcel = () => {
    const devs = devolucionesFiltradas();
    if (devs.length === 0) return;
    const headers = ['# Dev', 'Fecha', '# Venta', 'Cliente', 'Producto', 'Cantidad', 'Motivo', 'Estado', 'Reembolso (Bs)'];
    const rows = devs.map((d: any) => [
      `#${d.id}`, new Date(d.fecha).toLocaleDateString('es-BO'), `#${d.venta}`,
      d.cliente_nombre || '—', d.producto_nombre || '—', d.cantidad,
      motivoDev(d), d.estado === 'aprobada' ? 'Aprobada' : 'Rechazada',
      Number(Number(d.monto_reembolso || 0).toFixed(2)),
    ]);
    const totalReembolso = devs.filter((d: any) => d.estado === 'aprobada')
      .reduce((s: number, d: any) => s + Number(d.monto_reembolso || 0), 0);
    exportToExcel({
      filename: `reporte_devoluciones_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Devoluciones', headers, rows,
      totalRow: ['', '', '', '', '', '', '', 'TOTAL REEMBOLSADO', Number(totalReembolso.toFixed(2))],
    });
  };

  const descargarDevPDF = async () => {
    const devs = devolucionesFiltradas();
    if (devs.length === 0) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const logo = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = '/logo.png';
    });
    const body = devs.map((d: any) => [
      `#${d.id}`, new Date(d.fecha).toLocaleDateString('es-BO'), `#${d.venta}`,
      d.cliente_nombre || '—', d.producto_nombre || '—', String(d.cantidad),
      motivoDev(d), d.estado === 'aprobada' ? 'Aprobada' : 'Rechazada',
      Number(d.monto_reembolso || 0).toFixed(2),
    ]);
    const totalReembolso = devs.filter((d: any) => d.estado === 'aprobada')
      .reduce((s: number, d: any) => s + Number(d.monto_reembolso || 0), 0);
    const now = new Date();
    autoTable(doc, {
      startY: 92,
      margin: { top: 92, left: 24, right: 24, bottom: 34 },
      head: [['# Dev', 'Fecha', '# Venta', 'Cliente', 'Producto', 'Cant.', 'Motivo', 'Estado', 'Reembolso (Bs)']],
      body,
      foot: [[{ content: 'TOTAL REEMBOLSADO (aprobadas)', colSpan: 8, styles: { halign: 'right' } },
              { content: `Bs ${totalReembolso.toFixed(2)}`, styles: { halign: 'right' } }]],
      showFoot: 'lastPage',
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: [180, 83, 9], textColor: 255 },
      footStyles: { fillColor: [180, 83, 9], textColor: 255, fontStyle: 'bold', fontSize: 10 },
      alternateRowStyles: { fillColor: [253, 246, 236] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 42 }, 1: { halign: 'center', cellWidth: 58 },
        2: { halign: 'center', cellWidth: 48 }, 3: { cellWidth: 90 }, 4: { cellWidth: 'auto' },
        5: { halign: 'center', cellWidth: 36 }, 6: { cellWidth: 130 }, 7: { halign: 'center', cellWidth: 60 },
        8: { halign: 'right', cellWidth: 80 },
      },
      didDrawPage: () => {
        if (logo) { try { doc.addImage(logo, 'PNG', 24, 16, 40, 40); } catch { /* logo opcional */ } }
        const xText = logo ? 72 : 24;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(180, 83, 9);
        doc.text('SANTA CRUZ - COMPUTER', xText, 30);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
        doc.text('Santa Cruz de la Sierra', xText, 44);
        doc.setFontSize(9); doc.setTextColor(70);
        doc.text(`Fecha: ${now.toLocaleDateString('es-BO')}`, pageWidth - 24, 26, { align: 'right' });
        doc.text(`Hora: ${now.toLocaleTimeString('es-BO')}`, pageWidth - 24, 40, { align: 'right' });
        doc.setDrawColor(180, 83, 9); doc.setLineWidth(1.5); doc.line(24, 54, pageWidth - 24, 54);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(180, 83, 9);
        doc.text('REPORTE DE DEVOLUCIONES', pageWidth / 2, 72, { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90);
        doc.text(`${devs.length} devolución(es)  ·  ${formatRangoFechas()}`, pageWidth / 2, 84, { align: 'center' });
      },
    });
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(130);
      doc.text('Documento generado automáticamente desde el sistema', 24, pageHeight - 16);
      doc.text(`Pág: ${i} de ${totalPages}`, pageWidth - 24, pageHeight - 16, { align: 'right' });
    }
    doc.save(`reporte_devoluciones_${new Date().toISOString().split('T')[0]}.pdf`);
    window.open(doc.output('bloburl'), '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Historial de Ventas</h1>
        <p className="text-gray-600">Control de ventas, pedidos y clientes</p>
      </div>

      {/* Estadísticas — solo admin */}
      {isAdmin && historialData && historialData.ventas.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total de Ventas</p>
                  <p className="text-2xl font-bold text-gray-900">{historialData.total_ventas}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Monto Total</p>
                  <p className="text-2xl font-bold text-gray-900">{(Number(historialData.total_monto) || 0).toFixed(2)} Bs</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Promedio por Venta</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {historialData.total_ventas > 0
                      ? ((Number(historialData.total_monto) || 0) / historialData.total_ventas).toFixed(2)
                      : '0.00'} Bs
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Recaudado por método de pago</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                <Banknote className="w-8 h-8 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Efectivo</p>
                  <p className="text-lg font-bold text-green-700">{totalEfectivo.toFixed(2)} Bs</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <QrCode className="w-8 h-8 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">QR / Transferencia</p>
                  <p className="text-lg font-bold text-blue-700">{totalTransferencia.toFixed(2)} Bs</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <CreditCard className="w-8 h-8 text-purple-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Tarjeta</p>
                  <p className="text-lg font-bold text-purple-700">{totalTarjeta.toFixed(2)} Bs</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex gap-2 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFiltro(tab.key); setClienteFiltrado(null); }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filtro === tab.key ? tab.activeClass : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generar Reporte: rango de fechas + botones Excel/PDF (solo en tabs de ventas) */}
      {filtro !== 'clientes' && historialData && historialData.ventas.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-200 flex flex-col lg:flex-row items-start lg:items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Generar Reporte:</span>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 whitespace-nowrap">Desde</label>
              <input type="date" value={repDesde} onChange={e => setRepDesde(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 whitespace-nowrap">Hasta</label>
              <input type="date" value={repHasta} onChange={e => setRepHasta(e.target.value)}
                min={repDesde}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 whitespace-nowrap">Vendedor</label>
              <select
                value={repVendedor}
                onChange={e => setRepVendedor(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]"
              >
                <option value="">Todos</option>
                <option value="online">Pedidos online</option>
                {vendedoresUnicos.map(v => (
                  <option key={v.id} value={String(v.id)}>{v.name}</option>
                ))}
              </select>
            </div>
            {(repDesde || repHasta || repVendedor !== '') && (
              <button onClick={() => { setRepDesde(''); setRepHasta(''); setRepVendedor(''); }}
                className="text-xs text-red-500 hover:text-red-700 hover:underline whitespace-nowrap">
                Limpiar
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {ventasReporte.length} venta(s) - Bs {totalGeneralReporte.toFixed(2)}
            </span>
            <button
              onClick={descargarExcel}
              disabled={ventasReporte.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              title="Descargar reporte en formato Excel (CSV)"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
            <button
              onClick={descargarPDF}
              disabled={ventasReporte.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              title="Descargar reporte en formato PDF"
            >
              <FileText className="w-4 h-4" /> PDF
            </button>
            {devolucionesReporte.length > 0 && (
              <>
                <span className="mx-1 hidden sm:inline text-gray-300">|</span>
                <button
                  onClick={descargarDevExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                  title="Reporte de devoluciones (Excel)"
                >
                  <RotateCcw className="w-4 h-4" /> Dev. Excel
                </button>
                <button
                  onClick={descargarDevPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors text-sm font-medium"
                  title="Reporte de devoluciones (PDF)"
                >
                  <RotateCcw className="w-4 h-4" /> Dev. PDF
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CLIENTES TAB ── */}
      {filtro === 'clientes' && (
        <div className="space-y-4">
          {clienteFiltrado ? (
            /* Vista filtrada por cliente */
            <>
              <div className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                <Users className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <span className="font-semibold text-purple-900">
                  Mostrando compras de: {nombreCliente(clienteFiltrado)}
                </span>
                <button
                  onClick={() => setClienteFiltrado(null)}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 text-sm font-medium"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver a la tabla
                </button>
              </div>

              {loadingClientVentas ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : clientVentas.length === 0 ? (
                <div className="bg-white rounded-xl p-8 border border-gray-200 text-center text-gray-500">
                  Este cliente no tiene compras registradas.
                </div>
              ) : (
                <div className="space-y-3">
                  {clientVentas.map(v => (
                    <div key={v.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      {/* Header expandible */}
                      <button
                        onClick={() => setExpandedClientVenta(expandedClientVenta === v.id ? null : v.id)}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 grid grid-cols-3 gap-3 text-left">
                          <div>
                            <p className="text-xs text-gray-500">Venta #</p>
                            <p className="font-semibold text-gray-900">{v.id}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Fecha</p>
                            <p className="font-semibold text-gray-900">
                              {new Date(v.fecha).toLocaleDateString('es-BO')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="font-bold text-green-600">{parseFloat(String(v.total)).toFixed(2)} Bs</p>
                          </div>
                        </div>
                        <div className="ml-4 flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${v.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {v.status === 'completed' ? 'Completada' : 'Pendiente'}
                          </span>
                          {expandedClientVenta === v.id
                            ? <ChevronUp className="w-4 h-4 text-gray-500" />
                            : <ChevronDown className="w-4 h-4 text-gray-500" />
                          }
                        </div>
                      </button>

                      {/* Acciones de la venta */}
                      {v.status === 'completed' && (
                        <div className="px-4 pb-3 flex gap-2 flex-wrap border-t border-gray-100 pt-3">
                          <button
                            onClick={() => window.open(`${API_BASE_URL}/orders/ventas/${v.id}/pdf/`, '_blank')}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            Descargar Factura
                          </button>
                          {(() => {
                            const enPlazo = dentroPlazoDevolucion(v.fecha);
                            const hayPend = detallesPendientes(v as unknown as ApiVenta).length > 0;
                            const habilitado = enPlazo && hayPend;
                            const tooltip = !enPlazo
                              ? 'Fuera de plazo: más de 7 días desde la compra'
                              : !hayPend
                                ? 'Todos los ítems ya fueron procesados (aprobados o rechazados)'
                                : '';
                            return (
                              <button
                                onClick={() => abrirDevolucion(v as unknown as ApiVenta)}
                                disabled={!habilitado}
                                title={tooltip}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-colors ${habilitado ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-400 cursor-not-allowed'}`}
                              >
                                <RotateCcw className="w-4 h-4" />
                                Registrar devolución
                              </button>
                            );
                          })()}
                        </div>
                      )}

                      {/* Detalles expandidos */}
                      {expandedClientVenta === v.id && (
                        <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
                          {/* Info general y pago */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Información</p>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Fecha:</span>
                                  <span className="font-medium text-gray-900">{new Date(v.fecha).toLocaleDateString('es-BO')}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Hora:</span>
                                  <span className="font-medium text-gray-900">{new Date(v.fecha).toLocaleTimeString('es-BO')}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Vendedor:</span>
                                  <span className="font-medium text-gray-900">{(v as any).vendedor_name || 'Pedido online'}</span>
                                </div>
                              </div>
                            </div>
                            {v.pagos && v.pagos.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Pago</p>
                                <div className="space-y-1 text-sm">
                                  {v.pagos.map((pago: any) => (
                                    <div key={pago.id}>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Método:</span>
                                        <span className="font-medium text-gray-900">{formatMetodo(pago.metodo)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Monto:</span>
                                        <span className="font-medium text-gray-900">{(Number(pago.monto) || 0).toFixed(2)} Bs</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Tabla de productos */}
                          {v.detalles && v.detalles.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Productos</p>
                              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-100 border-b border-gray-200">
                                    <tr>
                                      <th className="text-left px-4 py-2 text-gray-700">Producto</th>
                                      <th className="text-center px-4 py-2 text-gray-700">Cant.</th>
                                      <th className="hidden sm:table-cell text-right px-4 py-2 text-gray-700">Precio Unit.</th>
                                      <th className="text-right px-4 py-2 text-gray-700">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {v.detalles.map((d: any) => (
                                      <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="px-4 py-2 font-medium text-gray-900">{d.producto_name}</td>
                                        <td className="text-center px-4 py-2 text-gray-700">{d.cantidad}</td>
                                        <td className="hidden sm:table-cell text-right px-4 py-2 text-gray-700">{(Number(d.precio_unitario) || 0).toFixed(2)} Bs</td>
                                        <td className="text-right px-4 py-2 font-semibold text-gray-900">{(Number(d.subtotal) || 0).toFixed(2)} Bs</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="mt-2 flex justify-end">
                                <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 text-sm">
                                  <span className="text-gray-600">Total: </span>
                                  <span className="text-lg font-bold text-purple-700">{parseFloat(String(v.total)).toFixed(2)} Bs</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : loadingClientes ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            </div>
          ) : (
            /* Tabla de clientes */
            apiClientes.length === 0 ? (
              <div className="bg-white rounded-xl p-12 border border-gray-200 text-center text-gray-500">
                No hay clientes registrados.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Nombre</th>
                        <th className="hidden sm:table-cell text-left py-3 px-4 text-sm font-medium text-gray-600">Última Compra</th>
                        <th className="hidden md:table-cell text-left py-3 px-4 text-sm font-medium text-gray-600">Correo</th>
                        <th className="hidden lg:table-cell text-left py-3 px-4 text-sm font-medium text-gray-600">Teléfono</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiClientes.map(cliente => (
                        <tr key={cliente.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-4 font-medium text-gray-900">{nombreCliente(cliente)}</td>
                          <td className="hidden sm:table-cell py-4 px-4 text-gray-600 text-sm">{getUltimaCompra(cliente.id)}</td>
                          <td className="hidden md:table-cell py-4 px-4 text-gray-600">{cliente.correo || '—'}</td>
                          <td className="hidden lg:table-cell py-4 px-4 text-gray-600">{cliente.telefono || '—'}</td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => handleVerCompras(cliente)}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                            >
                              <Eye className="w-4 h-4" /> Ver Compras
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* ── VENTAS TABS ── */}
      {filtro !== 'clientes' && (
        <>
          {loadError ? (
            <div className="bg-red-50 rounded-xl p-8 border border-red-200 text-center">
              <p className="text-red-600 font-medium">Error al cargar ventas</p>
              <p className="text-sm text-red-500 mt-1">{loadError}</p>
              <button onClick={cargarHistorial} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                Reintentar
              </button>
            </div>
          ) : (!historialData || historialData.ventas.length === 0) ? (
            <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No hay ventas registradas aún</p>
              <p className="text-sm text-gray-500">Las ventas aparecerán aquí automáticamente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ventasFiltradas.map(venta => (
                <div key={venta.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setExpandedVenta(expandedVenta === venta.id ? null : venta.id)}
                    className="w-full p-4 sm:p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Venta #</p>
                          <p className="font-semibold text-gray-900">{venta.id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Cliente</p>
                          <p className="font-semibold text-gray-900">{venta.cliente_name || 'General'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Fecha</p>
                          <p className="font-semibold text-gray-900">
                            {new Date(venta.fecha).toLocaleDateString('es-BO')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600 mb-1">Total</p>
                          <p className="font-bold text-lg text-green-600">{(Number(venta.total) || 0).toFixed(2)} Bs</p>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 flex flex-col items-end gap-1">
                      <div className="flex items-center">
                        {getStatusBadge(venta.status)}
                        {expandedVenta === venta.id
                          ? <ChevronUp className="w-5 h-5 text-gray-600" />
                          : <ChevronDown className="w-5 h-5 text-gray-600" />
                        }
                      </div>
                      {venta.status === 'pending' && (
                        <span className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-0.5">
                          Validación Manual
                        </span>
                      )}
                    </div>
                  </button>

                  {(canComplete && venta.status === 'pending') || venta.status === 'completed' ? (
                    <div className="px-4 sm:px-6 pb-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
                      {canComplete && venta.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleConfirmarEntrega(venta.id)}
                            disabled={updatingId === venta.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Confirmar Entrega
                          </button>
                          {updatingId === venta.id && (
                            <span className="text-xs text-gray-400">Actualizando...</span>
                          )}
                        </>
                      )}
                      {venta.status === 'completed' && (
                        <>
                          <button
                            onClick={() => window.open(`${API_BASE_URL}/orders/ventas/${venta.id}/pdf/`, '_blank')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            Descargar Factura
                          </button>
                          {(() => {
                            const enPlazo = dentroPlazoDevolucion(venta.fecha);
                            const hayPend = detallesPendientes(venta as unknown as ApiVenta).length > 0;
                            const habilitado = enPlazo && hayPend;
                            const tooltip = !enPlazo
                              ? 'Fuera de plazo: más de 7 días desde la compra'
                              : !hayPend
                                ? 'Todos los ítems ya fueron procesados (aprobados o rechazados)'
                                : '';
                            return (
                              <button
                                onClick={() => abrirDevolucion(venta as unknown as ApiVenta)}
                                disabled={!habilitado}
                                title={tooltip}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-colors ${habilitado ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-400 cursor-not-allowed'}`}
                              >
                                <RotateCcw className="w-4 h-4" />
                                Registrar devolución
                              </button>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  ) : null}

                  {expandedVenta === venta.id && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4 sm:p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-3">Información General</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Cliente:</span>
                              <span className="font-medium text-gray-900">{venta.cliente_name || 'General'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Vendedor:</span>
                              <span className="font-medium text-gray-900">{venta.vendedor_name || 'Pedido online'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Fecha:</span>
                              <span className="font-medium text-gray-900">
                                {new Date(venta.fecha).toLocaleDateString('es-BO')}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Hora:</span>
                              <span className="font-medium text-gray-900">
                                {new Date(venta.fecha).toLocaleTimeString('es-BO')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="font-semibold text-gray-900 mb-3">Método de Pago</h3>
                          {venta.pagos.length > 0 ? (
                            <div className="space-y-2 text-sm">
                              {venta.pagos.map(pago => (
                                <div key={pago.id}>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Método:</span>
                                    <span className="font-medium text-gray-900">{formatMetodo(pago.metodo)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Monto:</span>
                                    <span className="font-medium text-gray-900">{(Number(pago.monto) || 0).toFixed(2)} Bs</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm">No hay información de pago</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-6">
                        <h3 className="font-semibold text-gray-900 mb-3">Productos Vendidos</h3>
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-100 border-b border-gray-200">
                              <tr>
                                <th className="text-left px-4 py-2 text-gray-700">Producto</th>
                                <th className="text-center px-4 py-2 text-gray-700">Cant.</th>
                                <th className="hidden sm:table-cell text-right px-4 py-2 text-gray-700">Precio Unit.</th>
                                <th className="text-right px-4 py-2 text-gray-700">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {venta.detalles.map(detalle => (
                                <tr key={detalle.id} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="px-4 py-2 text-gray-900 font-medium">{detalle.producto_name}</td>
                                  <td className="text-center px-4 py-2 text-gray-700">{detalle.cantidad}</td>
                                  <td className="hidden sm:table-cell text-right px-4 py-2 text-gray-700">{(Number(detalle.precio_unitario) || 0).toFixed(2)} Bs</td>
                                  <td className="text-right px-4 py-2 font-semibold text-gray-900">
                                    {(Number(detalle.subtotal) || 0).toFixed(2)} Bs
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 w-full sm:min-w-[300px] sm:w-auto">
                            <div className="flex justify-between mb-2">
                              <span className="text-gray-700">Subtotal:</span>
                              <span className="font-medium text-gray-900">
                                {venta.detalles.reduce((sum, d) => sum + (Number(d.subtotal) || 0), 0).toFixed(2)} Bs
                              </span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-blue-200">
                              <span className="font-semibold text-gray-900">Total:</span>
                              <span className="text-xl font-bold text-blue-600">{(Number(venta.total) || 0).toFixed(2)} Bs</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {ventasFiltradas.length === 0 && (
                <div className="bg-white rounded-xl p-8 border border-gray-200 text-center text-gray-500">
                  No hay ventas con el filtro seleccionado.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── MODAL: Registrar devolución (CU23) ── */}
      {devVenta && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setDevVenta(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-600" /> Devolución — Venta #{devVenta.id}
              </h2>
              <button onClick={() => setDevVenta(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Producto a devolver</label>
                <select value={devDetalleId}
                  onChange={e => { setDevDetalleId(e.target.value ? Number(e.target.value) : ''); setDevCantidad(1); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">— Elige un producto —</option>
                  {detallesPendientes(devVenta).map(d => {
                    const disp = unidadesDisponiblesDetalle(d.id, d.cantidad);
                    const etiqueta = disp === d.cantidad
                      ? `${d.producto_name} (x${d.cantidad})`
                      : `${d.producto_name} (${disp} de ${d.cantidad} disponibles)`;
                    return <option key={d.id} value={d.id}>{etiqueta}</option>;
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                <input type="number" min={1}
                  max={devDetalleId
                    ? unidadesDisponiblesDetalle(devDetalleId, devVenta.detalles?.find(d => d.id === devDetalleId)?.cantidad ?? 1)
                    : 1}
                  value={devCantidad}
                  onChange={e => setDevCantidad(Math.max(1, Number(e.target.value) || 1))}
                  className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de la devolución</label>
                <textarea value={devMotivo} onChange={e => setDevMotivo(e.target.value)} rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Ej. Producto defectuoso, no era lo que esperaba..." />
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Inspección física</p>
                <label className="flex items-center gap-2 text-sm mb-1">
                  <input type="checkbox" checked={devInsp.sinDano} onChange={e => setDevInsp({ ...devInsp, sinDano: e.target.checked })} />
                  Sin daño ni manipulación
                </label>
                <label className="flex items-center gap-2 text-sm mb-1">
                  <input type="checkbox" checked={devInsp.mismo} onChange={e => setDevInsp({ ...devInsp, mismo: e.target.checked })} />
                  Es el mismo producto vendido
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={devInsp.completo} onChange={e => setDevInsp({ ...devInsp, completo: e.target.checked })} />
                  Completo (accesorios / empaque)
                </label>
                <p className={`text-xs mt-2 ${(devInsp.sinDano && devInsp.mismo && devInsp.completo) ? 'text-green-600' : 'text-amber-600'}`}>
                  {(devInsp.sinDano && devInsp.mismo && devInsp.completo)
                    ? '✓ Inspección confirmada — puedes aprobar.'
                    : 'Marca los 3 puntos para poder aprobar (deja constancia de que verificaste).'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de rechazo (solo si la rechazas)</label>
                <input value={devMotivoRechazo} onChange={e => setDevMotivoRechazo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Ej. Fuera de plazo, dañado por mal uso..." />
              </div>

              {devMsg && (
                <div className={`text-sm rounded-lg px-3 py-2 border ${devMsg.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {devMsg.text}
                </div>
              )}
            </div>

            <div className="flex gap-2 p-4 border-t border-gray-200">
              <button
                disabled={devLoading || !(devInsp.sinDano && devInsp.mismo && devInsp.completo)}
                onClick={() => submitDevolucion(true)}
                title={!(devInsp.sinDano && devInsp.mismo && devInsp.completo) ? 'Confirma los 3 puntos de la inspección física para aprobar' : ''}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                {devLoading ? 'Guardando...' : 'Aprobar'}
              </button>
              <button disabled={devLoading} onClick={() => submitDevolucion(false)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50">
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
