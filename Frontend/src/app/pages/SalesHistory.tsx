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
import { Package, DollarSign, Clock, ChevronDown, ChevronUp, CheckCircle, Banknote, CreditCard, QrCode, Users, Eye, ArrowLeft, FileText, FileSpreadsheet } from 'lucide-react';
import { ventasAPI, clientesAPI, API_BASE_URL, ApiCliente, ApiVenta } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { exportToExcel } from '../utils/exportExcel';

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
          rows.push([
            `#${v.id}`,
            v.cliente_name || 'General',
            v.vendedor_name || 'Pedido online',
            fecha,
            estado,
            d.producto_name,
            d.cantidad,
            Number(precio.toFixed(2)),
            Number((Number(d.subtotal) || 0).toFixed(2)),
          ]);
        });
      }
    });

    exportToExcel({
      filename: `reporte_ventas_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Ventas',
      headers,
      rows,
      // TOTAL GENERAL bajo "Precio Unit." y el valor bajo "Subtotal"
      totalRow: ['', '', '', '', '', '', '', 'TOTAL GENERAL', Number(totalGeneralReporte.toFixed(2))],
    });
  };

  // ── Exportar a PDF (jerárquico, vía window.print) ───────────────────────────
  const descargarPDF = () => {
    if (ventasReporte.length === 0) return;

    const bloques = ventasReporte.map(v => {
      const fecha = new Date(v.fecha).toLocaleDateString('es-BO');
      const hora = new Date(v.fecha).toLocaleTimeString('es-BO');
      const total = (Number(v.total) || 0).toFixed(2);
      const estado = v.status === 'completed' ? 'Completada'
        : v.status === 'pending' ? 'Pendiente'
        : v.status;
      const estadoClass = v.status === 'completed' ? 'badge-ok' : 'badge-warn';
      const detalles = v.detalles ?? [];

      const filasDetalle = detalles.length === 0
        ? `<tr><td colspan="4" class="empty">Sin productos registrados</td></tr>`
        : detalles.map(d => `
            <tr>
              <td>${d.producto_name}</td>
              <td class="right">${d.cantidad}</td>
              <td class="right">Bs ${(Number(d.precio_unitario) || 0).toFixed(2)}</td>
              <td class="right">Bs ${(Number(d.subtotal) || 0).toFixed(2)}</td>
            </tr>
          `).join('');

      return `
        <div class="venta">
          <div class="venta-header">
            <div>
              <span class="badge">Venta #${v.id}</span>
              <strong>${v.cliente_name || 'General'}</strong>
              <span class="meta-info">${fecha} ${hora}</span>
              <span class="badge ${estadoClass}">${estado}</span>
            </div>
            <div class="venta-total">Bs ${total}</div>
          </div>
          <div class="vendedor-info">Vendedor: ${v.vendedor_name || 'Pedido online'}</div>
          <table class="detalle">
            <thead>
              <tr>
                <th>Producto</th>
                <th class="right">Cantidad</th>
                <th class="right">Precio Unit.</th>
                <th class="right">Subtotal</th>
              </tr>
            </thead>
            <tbody>${filasDetalle}</tbody>
          </table>
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Reporte de Ventas</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; }
        h1 { color: #1e40af; margin: 0 0 4px 0; }
        .subtitle { color: #555; font-size: 13px; margin-bottom: 18px; }
        .meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: #444; margin-bottom: 20px; }
        .meta div { background: #f3f4f6; padding: 6px 10px; border-radius: 4px; }

        .venta { border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 14px; overflow: hidden; page-break-inside: avoid; }
        .venta-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #eff6ff; border-bottom: 1px solid #bfdbfe; font-size: 13px; }
        .venta-header .badge { display: inline-block; background: #1e40af; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 8px; font-weight: bold; }
        .venta-header .badge-ok { background: #16a34a; }
        .venta-header .badge-warn { background: #d97706; }
        .venta-header .meta-info { color: #555; margin: 0 8px; font-size: 12px; }
        .venta-total { font-weight: bold; color: #1e40af; font-size: 14px; }
        .vendedor-info { padding: 6px 12px; background: #fafafa; font-size: 11px; color: #6b7280; border-bottom: 1px solid #e5e7eb; }

        .detalle { width: 100%; border-collapse: collapse; font-size: 11px; }
        .detalle th { background: #f9fafb; color: #374151; padding: 6px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; font-weight: 600; }
        .detalle th.right, .detalle td.right { text-align: right; }
        .detalle td { padding: 6px 10px; border-bottom: 1px solid #f3f4f6; }
        .detalle tr:last-child td { border-bottom: none; }
        .empty { color: #9ca3af; font-style: italic; text-align: center; padding: 10px; }

        .total-general { margin-top: 18px; padding: 14px 16px; background: #1e40af; color: white; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
        .total-general strong { font-size: 16px; }

        .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; color: #999; font-size: 10px; text-align: center; }
        @media print { @page { margin: 1cm; } body { padding: 0; } }
      </style></head><body>
        <h1>Reporte de Ventas</h1>
        <div class="subtitle">Santa Cruz Computer - Sistema de Inventario</div>
        <div class="meta">
          <div><strong>Tipo:</strong> ${tipoReporte}</div>
          <div><strong>Rango:</strong> ${formatRangoFechas()}</div>
          <div><strong>Vendedor:</strong> ${vendedorReporteNombre}</div>
          <div><strong>Total ventas:</strong> ${ventasReporte.length}</div>
          <div><strong>Generado:</strong> ${new Date().toLocaleString('es-BO')}</div>
        </div>
        ${bloques}
        <div class="total-general">
          <span>MONTO TOTAL DEL REPORTE</span>
          <strong>Bs ${totalGeneralReporte.toFixed(2)}</strong>
        </div>
        <div class="footer">Documento generado automaticamente desde el sistema</div>
      </body></html>
    `;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('Permite las ventanas emergentes para descargar el PDF.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
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

                      {/* Botón factura */}
                      {v.status === 'completed' && (
                        <div className="px-4 pb-3 flex border-t border-gray-100 pt-3">
                          <button
                            onClick={() => window.open(`${API_BASE_URL}/orders/ventas/${v.id}/pdf/`, '_blank')}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            Descargar Factura
                          </button>
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
                        <button
                          onClick={() => window.open(`${API_BASE_URL}/orders/ventas/${venta.id}/pdf/`, '_blank')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          Descargar Factura
                        </button>
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
    </div>
  );
}
