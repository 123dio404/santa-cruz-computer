/**
 * Inventory.tsx - Control de Inventario
 *
 * Página de gestión del almacén, accesible para admin y empleados.
 * Tiene tres pestañas para ver el estado completo del inventario:
 *
 * TABS:
 * - Almacén:        Lista completa de productos con stock actual, precio y disponibilidad
 * - Entrada de Stock: Historial de compras a proveedores (cuánto ingresó y cuándo)
 * - Salida de Stock:  Historial de ventas realizadas (cuánto salió y cuándo)
 *
 * ALERTAS:
 * - Si un producto tiene stock ≤ stock_minimo, aparece destacado en rojo
 * - Se muestra un banner de alerta con los productos afectados
 *
 * DETALLE DE PRODUCTO:
 * - Al hacer clic en el ojo (👁) de cualquier producto, abre un modal con ficha técnica completa
 */
import { useState, useEffect } from 'react';
import { Search, AlertTriangle, Package, Eye, X, TrendingDown, TrendingUp, Warehouse, FileSpreadsheet, FileText } from 'lucide-react';
import { productosAPI, comprasAPI, ventasAPI, BACKEND_ROOT_URL, ApiProduct, ApiCompra, ApiVenta } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { exportToExcel } from '../utils/exportExcel';
import { useEscapeKey } from '../hooks/useEscapeKey';

type Tab = 'almacen' | 'entrada' | 'salida';

export function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState<Tab>('almacen');

  // ── Almacén ────────────────────────────────────────────────────────────────
  const [products, setProducts]           = useState<ApiProduct[]>([]);
  const [loading, setLoading]             = useState(true);
  const [searchTerm, setSearchTerm]       = useState('');
  const [detailProduct, setDetailProduct] = useState<ApiProduct | null>(null);

  // ── Entrada de Stock ───────────────────────────────────────────────────────
  const [compras, setCompras]           = useState<ApiCompra[]>([]);
  const [loadingCompras, setLoadingCompras] = useState(false);

  // ── Salida de Stock ────────────────────────────────────────────────────────
  const [ventas, setVentas]             = useState<ApiVenta[]>([]);
  const [loadingVentas, setLoadingVentas] = useState(false);

  // ── Filtros de fecha para Entrada/Salida ───────────────────────────────────
  const [entradaDesde, setEntradaDesde] = useState('');
  const [entradaHasta, setEntradaHasta] = useState('');
  const [salidaDesde, setSalidaDesde] = useState('');
  const [salidaHasta, setSalidaHasta] = useState('');

  useEffect(() => { loadProducts(); }, []);

  useEffect(() => {
    if (tab === 'entrada' && compras.length === 0) loadCompras();
    if (tab === 'salida'  && ventas.length  === 0) loadVentas();
  }, [tab]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setProducts(await productosAPI.getAll());
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const loadCompras = async () => {
    setLoadingCompras(true);
    try { setCompras(await comprasAPI.getAll()); }
    catch { /* silent */ }
    finally { setLoadingCompras(false); }
  };

  const loadVentas = async () => {
    setLoadingVentas(true);
    try { setVentas(await ventasAPI.getAll()); }
    catch { /* silent */ }
    finally { setLoadingVentas(false); }
  };

  // ── Almacén helpers ────────────────────────────────────────────────────────
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.marca  ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.modelo ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalItems        = filtered.reduce((s, p) => s + (p.stock ?? 0), 0);
  const totalValue        = filtered.reduce((s, p) => s + (parseFloat(String(p.precio_venta ?? p.price)) * (p.stock ?? 0)), 0);
  const lowStockProducts  = products.filter(p => p.is_low_stock);


  const imgSrc = (url: string) =>
    url.startsWith('http') ? url : `${BACKEND_ROOT_URL}${url}`;

  // ── Filas aplanadas Entrada ────────────────────────────────────────────────
  const entradaRowsAll = compras.flatMap(c =>
    (c.detalles ?? []).map(d => ({
      key:      `${c.id}-${d.id}`,
      compra_id: c.id,
      fecha:    c.fecha_compra,
      proveedor: c.proveedor_nombre,
      modelo:   d.producto_modelo || d.producto_nombre,
      cantidad: d.cantidad,
    }))
  );

  const entradaRows = entradaRowsAll.filter(r => {
    const f = new Date(r.fecha);
    const desde = entradaDesde ? new Date(entradaDesde) : null;
    const hasta = entradaHasta ? new Date(entradaHasta + 'T23:59:59') : null;
    return (!desde || f >= desde) && (!hasta || f <= hasta);
  });

  // ── Filas aplanadas Salida ─────────────────────────────────────────────────
  const salidaRowsAll = ventas.flatMap(v =>
    (v.detalles ?? []).map(d => ({
      key:      `${v.id}-${d.id}`,
      venta_id: v.id,
      fecha:    v.fecha,
      cliente:  v.cliente_name || 'Sin cliente',
      producto: d.producto_name || `Producto #${d.producto}`,
      cantidad: d.cantidad,
    }))
  );

  const salidaRows = salidaRowsAll.filter(r => {
    const f = new Date(r.fecha);
    const desde = salidaDesde ? new Date(salidaDesde) : null;
    const hasta = salidaHasta ? new Date(salidaHasta + 'T23:59:59') : null;
    return (!desde || f >= desde) && (!hasta || f <= hasta);
  });

  // ── Helpers de exportación ─────────────────────────────────────────────────
  const triggerPDF = (title: string, metaItems: { label: string; value: string }[], headers: string[], rows: string[][], totalLabel: string, totalValue: string) => {
    const metaHtml = metaItems.map(m => `<div><strong>${m.label}:</strong> ${m.value}</div>`).join('');
    const headHtml = headers.map((h, i) => `<th${i >= headers.length - 1 ? ' class="right"' : ''}>${h}</th>`).join('');
    const bodyHtml = rows.map(r => `<tr>${r.map((c, i) => `<td${i >= r.length - 1 ? ' class="right"' : ''}>${c}</td>`).join('')}</tr>`).join('');

    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; }
        h1 { color: #1e40af; margin: 0 0 4px 0; }
        .subtitle { color: #555; font-size: 13px; margin-bottom: 18px; }
        .meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: #444; margin-bottom: 18px; }
        .meta div { background: #f3f4f6; padding: 6px 10px; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #1e40af; color: white; padding: 10px 8px; text-align: left; }
        th.right, td.right { text-align: right; }
        td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) td { background: #f9fafb; }
        .total-general { margin-top: 18px; padding: 14px 16px; background: #1e40af; color: white; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
        .total-general strong { font-size: 16px; }
        .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; color: #999; font-size: 10px; text-align: center; }
        @media print { @page { margin: 1cm; } body { padding: 0; } }
      </style></head><body>
        <h1>${title}</h1>
        <div class="subtitle">Santa Cruz Computer - Sistema de Inventario</div>
        <div class="meta">${metaHtml}<div><strong>Generado:</strong> ${new Date().toLocaleString('es-BO')}</div></div>
        <table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>
        <div class="total-general"><span>${totalLabel}</span><strong>${totalValue}</strong></div>
        <div class="footer">Documento generado automaticamente desde el sistema</div>
      </body></html>
    `;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Permite las ventanas emergentes para descargar el PDF.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const formatRango = (d: string, h: string) => {
    if (d && h) return `Del ${d} al ${h}`;
    if (d) return `Desde ${d}`;
    if (h) return `Hasta ${h}`;
    return 'Todas las fechas';
  };

  // ── Export Almacén ─────────────────────────────────────────────────────────
  const descargarAlmacenExcel = () => {
    if (filtered.length === 0) return;
    const headers = ['Producto', 'Marca', 'Modelo', 'Categoría', 'P. Venta (Bs)', 'P. Compra (Bs)', 'Stock', 'Stock Mín.', 'Disponibilidad'];
    const rows: (string | number)[][] = filtered.map(p => [
      p.name,
      p.marca ?? '-',
      p.modelo ?? '-',
      p.categoria_nombre ?? '-',
      Number(parseFloat(String(p.precio_venta ?? p.price)).toFixed(2)),
      p.precio_compra != null ? Number(parseFloat(String(p.precio_compra)).toFixed(2)) : '-',
      p.stock ?? 0,
      p.stock_minimo,
      p.is_low_stock ? 'Stock Bajo' : 'Disponible',
    ]);
    rows.push(['', '', '', '', '', '', '', 'TOTAL UNIDADES', totalItems]);
    rows.push(['', '', '', '', '', '', '', 'VALOR INVENTARIO (Bs)', Number(totalValue.toFixed(2))]);
    exportToExcel({
      filename: `reporte_almacen_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Almacén',
      headers,
      rows,
    });
  };

  const descargarAlmacenPDF = () => {
    if (filtered.length === 0) return;
    const headers = ['Producto', 'Marca/Modelo', 'Categoría', 'P. Venta', 'Stock', 'Stock Mín.', 'Estado'];
    const rows = filtered.map(p => [
      p.name,
      [p.marca, p.modelo].filter(Boolean).join(' / ') || '-',
      p.categoria_nombre ?? '-',
      `Bs ${parseFloat(String(p.precio_venta ?? p.price)).toFixed(2)}`,
      String(p.stock ?? 0),
      String(p.stock_minimo),
      p.is_low_stock ? 'Stock Bajo' : 'Disponible',
    ]);
    triggerPDF(
      'Reporte de Almacén',
      [
        { label: 'Total productos', value: String(filtered.length) },
        { label: 'Búsqueda', value: searchTerm || 'Todos' },
      ],
      headers, rows,
      `VALOR INVENTARIO: ${totalItems} unidades`,
      `Bs ${totalValue.toFixed(2)}`,
    );
  };

  // ── Export Entrada ─────────────────────────────────────────────────────────
  const totalEntrada = entradaRows.reduce((s, r) => s + r.cantidad, 0);

  const descargarEntradaExcel = () => {
    if (entradaRows.length === 0) return;
    const headers = ['# Compra', 'Fecha', 'Proveedor', 'Producto', 'Cantidad'];
    const rows: (string | number)[][] = entradaRows.map(r => [
      `#${r.compra_id}`,
      new Date(r.fecha).toLocaleDateString('es-BO'),
      r.proveedor,
      r.modelo,
      r.cantidad,
    ]);
    exportToExcel({
      filename: `reporte_entrada_stock_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Entrada Stock',
      headers,
      rows,
      totalRow: ['', '', '', 'TOTAL UNIDADES INGRESADAS', totalEntrada],
    });
  };

  const descargarEntradaPDF = () => {
    if (entradaRows.length === 0) return;
    const headers = ['# Compra', 'Fecha', 'Proveedor', 'Producto', 'Cantidad'];
    const rows = entradaRows.map(r => [
      `#${r.compra_id}`,
      new Date(r.fecha).toLocaleDateString('es-BO'),
      r.proveedor,
      r.modelo,
      `+${r.cantidad}`,
    ]);
    triggerPDF(
      'Reporte de Entrada de Stock',
      [
        { label: 'Rango', value: formatRango(entradaDesde, entradaHasta) },
        { label: 'Total líneas', value: String(entradaRows.length) },
      ],
      headers, rows,
      'TOTAL UNIDADES INGRESADAS',
      `+${totalEntrada}`,
    );
  };

  // ── Export Salida ──────────────────────────────────────────────────────────
  const totalSalida = salidaRows.reduce((s, r) => s + r.cantidad, 0);

  const descargarSalidaExcel = () => {
    if (salidaRows.length === 0) return;
    const headers = ['# Venta', 'Fecha', 'Cliente', 'Producto', 'Cantidad'];
    const rows: (string | number)[][] = salidaRows.map(r => [
      `#${r.venta_id}`,
      new Date(r.fecha).toLocaleDateString('es-BO'),
      r.cliente,
      r.producto,
      r.cantidad,
    ]);
    exportToExcel({
      filename: `reporte_salida_stock_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Salida Stock',
      headers,
      rows,
      totalRow: ['', '', '', 'TOTAL UNIDADES VENDIDAS', totalSalida],
    });
  };

  const descargarSalidaPDF = () => {
    if (salidaRows.length === 0) return;
    const headers = ['# Venta', 'Fecha', 'Cliente', 'Producto', 'Cantidad'];
    const rows = salidaRows.map(r => [
      `#${r.venta_id}`,
      new Date(r.fecha).toLocaleDateString('es-BO'),
      r.cliente,
      r.producto,
      `-${r.cantidad}`,
    ]);
    triggerPDF(
      'Reporte de Salida de Stock',
      [
        { label: 'Rango', value: formatRango(salidaDesde, salidaHasta) },
        { label: 'Total líneas', value: String(salidaRows.length) },
      ],
      headers, rows,
      'TOTAL UNIDADES VENDIDAS',
      `-${totalSalida}`,
    );
  };

  // Cerrar el modal de detalle con Esc
  useEscapeKey(!!detailProduct, () => setDetailProduct(null));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <p className="text-gray-600">Control de almacén, entradas y salidas de stock</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-1 overflow-x-auto">
        {([
          { key: 'almacen', label: 'Almacén',         icon: Warehouse   },
          { key: 'entrada', label: 'Entrada de Stock', icon: TrendingUp  },
          { key: 'salida',  label: 'Salida de Stock',  icon: TrendingDown },
        ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ══ TAB: ALMACÉN ═════════════════════════════════════════════════════ */}
      {tab === 'almacen' && (
        <>
          {/* Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Total Productos</p>
              <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Total Unidades</p>
              <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Valor Inventario</p>
              <p className="text-2xl font-bold text-gray-900">{totalValue.toFixed(2)} Bs</p>
            </div>
          </div>

          {/* Buscador + Reportes */}
          <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Buscar por nombre, marca, modelo..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={descargarAlmacenExcel}
                disabled={filtered.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                title="Descargar reporte en formato Excel"
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
              <button
                onClick={descargarAlmacenPDF}
                disabled={filtered.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                title="Descargar reporte en formato PDF"
              >
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>

          {/* Alerta stock bajo */}
          {lowStockProducts.length > 0 && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-900">Alerta de Stock Bajo</h3>
                  <p className="text-sm text-red-700 mt-1">
                    {lowStockProducts.length} producto{lowStockProducts.length !== 1 ? 's' : ''} con stock ≤ stock mínimo
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lowStockProducts.map(p => (
                      <span key={p.id} className="bg-white px-3 py-1 rounded text-sm border border-red-200 text-red-900">
                        {p.name} — {p.stock ?? 0} / mín {p.stock_minimo}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabla almacén */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Producto</th>
                    <th className="hidden sm:table-cell text-left py-3 px-4 font-medium text-gray-600">Marca / Modelo</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">P. Venta</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Stock</th>
                    <th className="hidden md:table-cell text-center py-3 px-4 font-medium text-gray-600">Stock Mín.</th>
                    <th className="hidden md:table-cell text-center py-3 px-4 font-medium text-gray-600">Disponibilidad</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(product => (
                    <tr key={product.id} className={`border-b border-gray-100 hover:bg-gray-50 ${product.is_low_stock ? 'bg-red-50' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                            {product.imagen_url
                              ? <img src={imgSrc(product.imagen_url)} alt={product.name} className="w-full h-full object-contain p-0.5" />
                              : <Package className="w-5 h-5 text-blue-400" />
                            }
                          </div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell py-3 px-4 text-gray-600">
                        {[product.marca, product.modelo].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        {parseFloat(String(product.precio_venta ?? product.price)).toFixed(2)} Bs
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-bold ${product.is_low_stock ? 'text-red-600' : 'text-gray-900'}`}>
                          {product.stock ?? 0}
                        </span>
                      </td>
                      <td className="hidden md:table-cell py-3 px-4 text-center text-gray-500">{product.stock_minimo}</td>
                      <td className="hidden md:table-cell py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          product.is_low_stock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {product.is_low_stock ? 'Stock Bajo' : 'Disponible'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setDetailProduct(product)} title="Ver detalles"
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══ TAB: ENTRADA DE STOCK ════════════════════════════════════════════ */}
      {tab === 'entrada' && (
        <div className="space-y-4">
          {/* Filtro de fechas + Reportes */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 flex flex-col lg:flex-row items-start lg:items-center gap-3">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Rango de fechas:</span>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">Desde</label>
                <input type="date" value={entradaDesde} onChange={e => setEntradaDesde(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">Hasta</label>
                <input type="date" value={entradaHasta} onChange={e => setEntradaHasta(e.target.value)}
                  min={entradaDesde}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              {(entradaDesde || entradaHasta) && (
                <button onClick={() => { setEntradaDesde(''); setEntradaHasta(''); }}
                  className="text-xs text-red-500 hover:text-red-700 hover:underline whitespace-nowrap">
                  Limpiar
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 lg:ml-auto">
              <button
                onClick={descargarEntradaExcel}
                disabled={entradaRows.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
              <button
                onClick={descargarEntradaPDF}
                disabled={entradaRows.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>

          {/* Métrica rápida */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <p className="text-sm text-gray-500">Compras (filtradas)</p>
              <p className="text-2xl font-bold text-gray-900">{new Set(entradaRows.map(r => r.compra_id)).size}</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <p className="text-sm text-gray-500">Líneas de producto</p>
              <p className="text-2xl font-bold text-gray-900">{entradaRows.length}</p>
            </div>
            <div className="hidden sm:block bg-white rounded-xl p-5 border border-gray-200">
              <p className="text-sm text-gray-500">Unidades ingresadas</p>
              <p className="text-2xl font-bold text-green-700">
                {totalEntrada}
              </p>
            </div>
          </div>

          {loadingCompras ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mr-3" />
              Cargando entradas…
            </div>
          ) : entradaRows.length === 0 ? (
            <div className="bg-white rounded-xl p-12 border border-gray-200 text-center text-gray-500">
              <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>No hay entradas de stock registradas.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Compra</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Fecha</th>
                      <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-gray-600">Proveedor</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Producto (Modelo)</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {entradaRows.map((row, idx) => (
                      <tr key={row.key} className={`hover:bg-gray-50 ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                            #{row.compra_id}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {new Date(row.fecha).toLocaleDateString('es-BO')}
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-gray-600 truncate max-w-[160px]">
                          {row.proveedor}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{row.modelo}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold">
                            +{row.cantidad}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: SALIDA DE STOCK ═════════════════════════════════════════════ */}
      {tab === 'salida' && (
        <div className="space-y-4">
          {/* Filtro de fechas + Reportes */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 flex flex-col lg:flex-row items-start lg:items-center gap-3">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Rango de fechas:</span>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">Desde</label>
                <input type="date" value={salidaDesde} onChange={e => setSalidaDesde(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">Hasta</label>
                <input type="date" value={salidaHasta} onChange={e => setSalidaHasta(e.target.value)}
                  min={salidaDesde}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              {(salidaDesde || salidaHasta) && (
                <button onClick={() => { setSalidaDesde(''); setSalidaHasta(''); }}
                  className="text-xs text-red-500 hover:text-red-700 hover:underline whitespace-nowrap">
                  Limpiar
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 lg:ml-auto">
              <button
                onClick={descargarSalidaExcel}
                disabled={salidaRows.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
              <button
                onClick={descargarSalidaPDF}
                disabled={salidaRows.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>

          {/* Métrica rápida */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <p className="text-sm text-gray-500">Ventas (filtradas)</p>
              <p className="text-2xl font-bold text-gray-900">{new Set(salidaRows.map(r => r.venta_id)).size}</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <p className="text-sm text-gray-500">Líneas de producto</p>
              <p className="text-2xl font-bold text-gray-900">{salidaRows.length}</p>
            </div>
            <div className="hidden sm:block bg-white rounded-xl p-5 border border-gray-200">
              <p className="text-sm text-gray-500">Unidades vendidas</p>
              <p className="text-2xl font-bold text-red-600">
                -{totalSalida}
              </p>
            </div>
          </div>

          {loadingVentas ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mr-3" />
              Cargando salidas…
            </div>
          ) : salidaRows.length === 0 ? (
            <div className="bg-white rounded-xl p-12 border border-gray-200 text-center text-gray-500">
              <TrendingDown className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>No hay salidas de stock registradas.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Venta</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Fecha</th>
                      <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-gray-600">Cliente</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Producto</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {salidaRows.map((row, idx) => (
                      <tr key={row.key} className={`hover:bg-gray-50 ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                            #{row.venta_id}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {new Date(row.fecha).toLocaleDateString('es-BO')}
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-gray-600 truncate max-w-[160px]">
                          {row.cliente}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{row.producto}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">
                            -{row.cantidad}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal detalle producto (Almacén) */}
      {detailProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setDetailProduct(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-xl"
            onClick={e => e.stopPropagation()}>
            <div className="h-48 bg-gray-50 flex items-center justify-center relative overflow-hidden border-b border-gray-100">
              {detailProduct.imagen_url
                ? <img src={imgSrc(detailProduct.imagen_url)} alt={detailProduct.name} className="w-full h-full object-contain p-3" />
                : <Package className="w-20 h-20 text-blue-200" />
              }
              <button onClick={() => setDetailProduct(null)}
                className="absolute top-3 right-3 p-1.5 bg-white bg-opacity-80 rounded-full hover:bg-opacity-100 transition">
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-bold text-gray-900 leading-tight">{detailProduct.name}</h2>
                <span className="text-xl font-bold text-blue-600 whitespace-nowrap">
                  {parseFloat(String(detailProduct.precio_venta ?? detailProduct.price)).toFixed(2)} Bs
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-gray-700 mb-2">Ficha técnica</p>
                {([
                  ['Marca',      detailProduct.marca],
                  ['Modelo',     detailProduct.modelo],
                  ['Categoría',  detailProduct.categoria_nombre],
                  ['Stock',      detailProduct.stock ?? 0],
                  ['Stock mín.', detailProduct.stock_minimo],
                  ['P. Compra',  detailProduct.precio_compra
                    ? `${parseFloat(String(detailProduct.precio_compra)).toFixed(2)} Bs`
                    : null],
                ] as [string, unknown][])
                  .filter(([, v]) => v !== null && v !== undefined && v !== '')
                  .map(([label, value]) => (
                    <div key={label as string} className="flex justify-between">
                      <span className="text-gray-500">{label as string}</span>
                      <span className="font-medium text-gray-900">{String(value)}</span>
                    </div>
                  ))}
              </div>
              <button onClick={() => setDetailProduct(null)}
                className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
