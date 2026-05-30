/**
 * Suppliers.tsx - Gestión de Proveedores y Compras (Solo Admin)
 *
 * Módulo completo para gestionar proveedores y registrar compras de mercadería.
 *
 * TABS:
 * - Proveedores:   Lista de proveedores con CRUD (crear, editar, eliminar)
 * - Nueva Compra:  Formulario para registrar una compra a un proveedor
 *                  Se pueden agregar múltiples productos por compra
 * - Historial:     Registro de todas las compras realizadas con sus detalles
 *                  Incluye: fecha, proveedor, productos, cantidades y totales
 *
 * FLUJO DE NUEVA COMPRA:
 * 1. Seleccionar proveedor
 * 2. Agregar filas de productos (categoría → marca → producto → cantidad → costo)
 * 3. El sistema calcula el total automáticamente
 * 4. Al confirmar, el stock de cada producto se incrementa en el backend
 */
import { useState, useEffect } from 'react';
import {
  Plus, Edit, Trash2, X, Building2, ShoppingCart,
  PackageSearch, CheckCircle, AlertCircle, Loader2,
  ChevronDown, ChevronUp, ClipboardList,
  FileSpreadsheet, FileText,
} from 'lucide-react';
import {
  proveedoresAPI, comprasAPI, productosAPI, categoriasAPI,
  ApiProveedor, ApiCompra, ApiProduct, ApiCategoria,
} from '../services/api';
import { exportToExcel } from '../utils/exportExcel';

type Tab = 'proveedores' | 'nueva-compra' | 'historial';

interface ProveedorForm {
  nombre_empresa: string;
  nit: string;
  razon_social: string;
  contacto_nombre: string;
  telefono: string;
  correo: string;
  direccion: string;
  ciudad: string;
  activo: boolean;
}

const emptyProvForm = (): ProveedorForm => ({
  nombre_empresa: '',
  nit: '',
  razon_social: '',
  contacto_nombre: '',
  telefono: '',
  correo: '',
  direccion: '',
  ciudad: '',
  activo: true,
});

interface DetalleRow {
  id: string;
  categoria_id: number | null;
  marca: string | null;
  producto_id: number | null;
  cantidad: number;
  costo_unitario: number;
}

const emptyRow = (): DetalleRow => ({
  id: crypto.randomUUID(),
  categoria_id: null,
  marca: null,
  producto_id: null,
  cantidad: 1,
  costo_unitario: 0,
});

export function Suppliers() {
  const [tab, setTab] = useState<Tab>('proveedores');

  // ── Proveedores ────────────────────────────────────────────────────────────
  const [proveedores, setProveedores]     = useState<ApiProveedor[]>([]);
  const [loadingProv, setLoadingProv]     = useState(true);
  const [isModalOpen, setIsModalOpen]     = useState(false);
  const [editing, setEditing]             = useState<ApiProveedor | null>(null);
  const [provForm, setProvForm]           = useState<ProveedorForm>(emptyProvForm());
  const [savingProv, setSavingProv]       = useState(false);
  const [provError, setProvError]         = useState<string | null>(null);
  const [provSuccess, setProvSuccess]     = useState<string | null>(null);

  // ── Nueva Compra ───────────────────────────────────────────────────────────
  const [productos, setProductos]         = useState<ApiProduct[]>([]);
  const [categorias, setCategorias]       = useState<ApiCategoria[]>([]);
  const [selectedProv, setSelectedProv]   = useState<number | ''>('');
  const [filas, setFilas]                 = useState<DetalleRow[]>([emptyRow()]);
  const [savingCompra, setSavingCompra]   = useState(false);
  const [compraError, setCompraError]     = useState<string | null>(null);
  const [compraSuccess, setCompraSuccess] = useState<string | null>(null);

  // ── Historial ──────────────────────────────────────────────────────────────
  const [compras, setCompras]             = useState<ApiCompra[]>([]);
  const [loadingHist, setLoadingHist]     = useState(false);
  const [expandedId, setExpandedId]       = useState<number | null>(null);
  const [histDesde, setHistDesde]         = useState('');
  const [histHasta, setHistHasta]         = useState('');
  const [histProveedor, setHistProveedor] = useState<number | ''>('');

  // ── carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => { fetchProveedores(); }, []);

  useEffect(() => {
    if (tab === 'nueva-compra' && productos.length === 0) fetchProductos();
    if (tab === 'historial') fetchHistorial();
  }, [tab]);

  const fetchProveedores = async () => {
    setLoadingProv(true);
    try { setProveedores(await proveedoresAPI.getAll()); }
    catch { setProvError('No se pudieron cargar los proveedores.'); }
    finally { setLoadingProv(false); }
  };

  const fetchProductos = async () => {
    try {
      const [prods, cats] = await Promise.all([
        productosAPI.getAll(),
        categoriasAPI.getAll(),
      ]);
      setProductos(prods);
      setCategorias(cats);
    } catch { /* silent */ }
  };

  const fetchHistorial = async () => {
    setLoadingHist(true);
    try { setCompras(await comprasAPI.getAll()); }
    catch { /* silent */ }
    finally { setLoadingHist(false); }
  };

  // ── CRUD Proveedores ───────────────────────────────────────────────────────
  const setProvField = <K extends keyof ProveedorForm>(k: K, v: ProveedorForm[K]) =>
    setProvForm(f => ({ ...f, [k]: v }));

  const openModal = (p?: ApiProveedor) => {
    setEditing(p ?? null);
    setProvForm(p ? {
      nombre_empresa: p.nombre_empresa,
      nit: p.nit ?? '',
      razon_social: p.razon_social ?? '',
      contacto_nombre: p.contacto_nombre ?? '',
      telefono: p.telefono ?? '',
      correo: p.correo ?? '',
      direccion: p.direccion ?? '',
      ciudad: p.ciudad ?? '',
      activo: p.activo ?? true,
    } : emptyProvForm());
    setProvError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const handleSubmitProv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provForm.nombre_empresa.trim() || !provForm.nit.trim()) return;
    setSavingProv(true);
    setProvError(null);
    const payload: Partial<typeof provForm> = {
      nombre_empresa: provForm.nombre_empresa.trim(),
      nit: provForm.nit.trim(),
      razon_social: provForm.razon_social.trim() || undefined,
      contacto_nombre: provForm.contacto_nombre.trim() || undefined,
      telefono: provForm.telefono.trim() || undefined,
      correo: provForm.correo.trim() || undefined,
      direccion: provForm.direccion.trim() || undefined,
      ciudad: provForm.ciudad.trim() || undefined,
      activo: provForm.activo,
    };
    try {
      if (editing) {
        await proveedoresAPI.update(editing.id, payload);
        setProvSuccess('Proveedor actualizado.');
      } else {
        await proveedoresAPI.create(payload);
        setProvSuccess('Proveedor creado.');
      }
      closeModal();
      await fetchProveedores();
      setTimeout(() => setProvSuccess(null), 3000);
    } catch (err) {
      setProvError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSavingProv(false);
    }
  };

  const handleDeleteProv = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar proveedor "${nombre}"?`)) return;
    try {
      await proveedoresAPI.delete(id);
      setProvSuccess('Proveedor eliminado.');
      await fetchProveedores();
      setTimeout(() => setProvSuccess(null), 3000);
    } catch {
      setProvError('No se pudo eliminar. Puede tener compras asociadas.');
      setTimeout(() => setProvError(null), 4000);
    }
  };

  // ── Lógica filas detalle ───────────────────────────────────────────────────
  const updateFila = (id: string, field: keyof DetalleRow, value: any) =>
    setFilas(f => f.map(r => r.id === id ? { ...r, [field]: value } : r));

  const removeFila = (id: string) =>
    setFilas(f => f.length > 1 ? f.filter(r => r.id !== id) : f);

  const totalCompra = filas.reduce(
    (s, r) => s + (r.cantidad || 0) * (r.costo_unitario || 0), 0
  );

  const handleSubmitCompra = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompraError(null);
    if (!selectedProv) { setCompraError('Selecciona un proveedor.'); return; }
    const filasValidas = filas.filter(r => r.producto_id && r.cantidad > 0 && r.costo_unitario > 0);
    if (filasValidas.length === 0) { setCompraError('Agrega al menos un producto válido.'); return; }

    setSavingCompra(true);
    try {
      await comprasAPI.create({
        proveedor: Number(selectedProv),
        detalles: filasValidas.map(r => ({
          producto: r.producto_id!,
          cantidad: r.cantidad,
          costo_unitario: r.costo_unitario,
        })),
      });
      setCompraSuccess('Compra registrada. El stock fue actualizado.');
      setSelectedProv('');
      setFilas([emptyRow()]);
      setTimeout(() => setCompraSuccess(null), 4000);
    } catch (err) {
      setCompraError(err instanceof Error ? err.message : 'Error al registrar la compra.');
    } finally {
      setSavingCompra(false);
    }
  };

  // ── Historial: filtrado por fechas + proveedor (usado en render y exportación) ─
  const comprasFiltradas = compras.filter(c => {
    const fecha = new Date(c.fecha_compra);
    const desde = histDesde ? new Date(histDesde) : null;
    const hasta = histHasta ? new Date(histHasta + 'T23:59:59') : null;
    const okFecha = (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
    const okProv = histProveedor === '' || c.proveedor === histProveedor;
    return okFecha && okProv;
  });

  const totalGeneral = comprasFiltradas.reduce((sum, c) => sum + Number(c.monto_total), 0);

  const formatRangoFechas = () => {
    if (histDesde && histHasta) return `Del ${histDesde} al ${histHasta}`;
    if (histDesde) return `Desde ${histDesde}`;
    if (histHasta) return `Hasta ${histHasta}`;
    return 'Todos los registros';
  };

  const proveedorSeleccionadoNombre = histProveedor === ''
    ? 'Todos los proveedores'
    : (proveedores.find(p => p.id === histProveedor)?.nombre_empresa ?? '—');

  // ── Exportar a Excel (.xlsx) ───────────────────────────────────────────────
  // Formato plano: una fila por producto con datos de la compra repetidos.
  const descargarExcel = () => {
    if (comprasFiltradas.length === 0) return;
    const headers = [
      '# Compra', 'Proveedor', 'Fecha',
      'Producto', 'Cantidad', 'Costo Unit. (Bs)', 'Subtotal (Bs)',
    ];

    const rows: (string | number)[][] = [];
    comprasFiltradas.forEach(c => {
      const fecha = new Date(c.fecha_compra).toLocaleDateString('es-BO');
      const detalles = c.detalles ?? [];
      if (detalles.length === 0) {
        rows.push([`#${c.id}`, c.proveedor_nombre, fecha, '(sin detalle)', '', '', '']);
      } else {
        detalles.forEach(d => {
          const costo = Number(d.costo_unitario);
          rows.push([
            `#${c.id}`,
            c.proveedor_nombre,
            fecha,
            d.producto_nombre,
            d.cantidad,
            Number(costo.toFixed(2)),
            Number((d.cantidad * costo).toFixed(2)),
          ]);
        });
      }
    });

    exportToExcel({
      filename: `reporte_compras_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Compras',
      headers,
      rows,
      // TOTAL GENERAL bajo "Costo Unit." y el valor bajo "Subtotal"
      totalRow: ['', '', '', '', '', 'TOTAL GENERAL', Number(totalGeneral.toFixed(2))],
    });
  };

  // ── Exportar a PDF (vía window.print) ──────────────────────────────────────
  // Formato jerarquico: cada compra muestra su encabezado y los productos comprados.
  const descargarPDF = () => {
    if (comprasFiltradas.length === 0) return;

    const bloques = comprasFiltradas.map(c => {
      const fecha = new Date(c.fecha_compra).toLocaleDateString('es-BO');
      const total = Number(c.monto_total).toFixed(2);
      const detalles = c.detalles ?? [];

      const filasDetalle = detalles.length === 0
        ? `<tr><td colspan="4" class="empty">Sin productos registrados</td></tr>`
        : detalles.map(d => {
            const costo = Number(d.costo_unitario);
            return `
              <tr>
                <td>${d.producto_nombre}</td>
                <td class="right">${d.cantidad}</td>
                <td class="right">Bs ${costo.toFixed(2)}</td>
                <td class="right">Bs ${(d.cantidad * costo).toFixed(2)}</td>
              </tr>
            `;
          }).join('');

      return `
        <div class="compra">
          <div class="compra-header">
            <div>
              <span class="badge">Compra #${c.id}</span>
              <strong>${c.proveedor_nombre}</strong>
              <span class="fecha">${fecha}</span>
            </div>
            <div class="compra-total">Bs ${total}</div>
          </div>
          <table class="detalle">
            <thead>
              <tr>
                <th>Producto</th>
                <th class="right">Cantidad</th>
                <th class="right">Costo Unit.</th>
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
      <title>Reporte de Compras</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; }
        h1 { color: #1e40af; margin: 0 0 4px 0; }
        .subtitle { color: #555; font-size: 13px; margin-bottom: 18px; }
        .meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: #444; margin-bottom: 20px; }
        .meta div { background: #f3f4f6; padding: 6px 10px; border-radius: 4px; }

        .compra { border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 14px; overflow: hidden; page-break-inside: avoid; }
        .compra-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #eff6ff; border-bottom: 1px solid #bfdbfe; font-size: 13px; }
        .compra-header .badge { display: inline-block; background: #1e40af; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 8px; font-weight: bold; }
        .compra-header .fecha { color: #555; margin-left: 10px; font-size: 12px; }
        .compra-total { font-weight: bold; color: #1e40af; font-size: 14px; }

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
        <h1>Reporte de Compras a Proveedores</h1>
        <div class="subtitle">Santa Cruz Computer - Sistema de Inventario</div>
        <div class="meta">
          <div><strong>Rango:</strong> ${formatRangoFechas()}</div>
          <div><strong>Proveedor:</strong> ${proveedorSeleccionadoNombre}</div>
          <div><strong>Total compras:</strong> ${comprasFiltradas.length}</div>
          <div><strong>Generado:</strong> ${new Date().toLocaleString('es-BO')}</div>
        </div>
        ${bloques}
        <div class="total-general">
          <span>MONTO TOTAL DEL REPORTE</span>
          <strong>Bs ${totalGeneral.toFixed(2)}</strong>
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Proveedores y Compras</h1>
        <p className="text-gray-600">Gestiona proveedores, registra compras y controla el stock</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Proveedores', value: proveedores.length, icon: Building2, color: 'blue' },
          { label: 'Compras registradas', value: compras.length, icon: ShoppingCart, color: 'green' },
          { label: 'Productos disponibles', value: productos.length, icon: PackageSearch, color: 'purple' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 border border-gray-200 flex items-center gap-4">
            <div className={`p-3 bg-${color}-100 rounded-lg`}>
              <Icon className={`w-6 h-6 text-${color}-600`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-1 overflow-x-auto">
        {([
          { key: 'proveedores',  label: 'Proveedores',   icon: Building2 },
          { key: 'nueva-compra', label: 'Nueva Compra',  icon: ShoppingCart },
          { key: 'historial',    label: 'Historial',     icon: ClipboardList },
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

      {/* ══ TAB: PROVEEDORES ══════════════════════════════════════════════════ */}
      {tab === 'proveedores' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Nuevo Proveedor
            </button>
          </div>

          {provSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> {provSuccess}
            </div>
          )}
          {provError && !isModalOpen && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {provError}
            </div>
          )}

          {loadingProv ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando proveedores…
            </div>
          ) : proveedores.length === 0 ? (
            <div className="bg-white rounded-xl p-12 border border-gray-200 text-center text-gray-500">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>No hay proveedores registrados.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">#</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Empresa</th>
                      <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-gray-600">NIT</th>
                      <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-gray-600">Contacto</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-gray-600">Teléfono</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-gray-600">Ciudad</th>
                      <th className="hidden xl:table-cell px-4 py-3 text-left font-medium text-gray-600">Dirección</th>
                      <th className="hidden sm:table-cell px-4 py-3 text-center font-medium text-gray-600">Estado</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {proveedores.map((p, i) => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-4 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                              <Building2 className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p>{p.nombre_empresa}</p>
                              {p.razon_social && <p className="text-xs text-gray-500">{p.razon_social}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-4 text-gray-600">{p.nit || '—'}</td>
                        <td className="hidden md:table-cell px-4 py-4 text-gray-600">{p.contacto_nombre || '—'}</td>
                        <td className="hidden lg:table-cell px-4 py-4 text-gray-600">{p.telefono || '—'}</td>
                        <td className="hidden lg:table-cell px-4 py-4 text-gray-600">{p.ciudad || '—'}</td>
                        <td className="hidden xl:table-cell px-4 py-4 text-gray-600 max-w-[180px] truncate">{p.direccion || '—'}</td>
                        <td className="hidden sm:table-cell px-4 py-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${p.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {p.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openModal(p)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs font-medium"
                            >
                              <Edit className="w-3.5 h-3.5" /> Editar
                            </button>
                            <button
                              onClick={() => handleDeleteProv(p.id, p.nombre_empresa)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-xs font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Eliminar
                            </button>
                          </div>
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

      {/* ══ TAB: NUEVA COMPRA ════════════════════════════════════════════════ */}
      {tab === 'nueva-compra' && (
        <form onSubmit={handleSubmitCompra} className="space-y-6 pb-52">
          {/* Proveedor */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Datos de la Compra</h2>
            <div className="w-full sm:max-w-sm">
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
              <select
                value={selectedProv}
                onChange={e => setSelectedProv(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              >
                <option value=""> Seleccionar proveedor </option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre_empresa}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filas de productos */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Detalle de Productos</h2>
              <button
                type="button"
                onClick={() => setFilas(f => [...f, emptyRow()])}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Agregar fila
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Categoría</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Marca</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Producto</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Cantidad</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 hidden sm:table-cell">Costo Unit. (Bs)</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Subtotal</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filas.map((fila) => {
                    const subtotal = (fila.cantidad || 0) * (fila.costo_unitario || 0);

                    // Productos filtrados por categoría
                    const porCategoria = fila.categoria_id
                      ? productos.filter(p => p.categoria === fila.categoria_id)
                      : productos;

                    // Marcas disponibles según la categoría seleccionada
                    const marcasDisponibles = Array.from(new Set(
                      porCategoria.map(p => p.marca).filter(Boolean)
                    )) as string[];

                    // Productos filtrados por categoría + marca
                    const productosFiltrados = fila.marca
                      ? porCategoria.filter(p => p.marca === fila.marca)
                      : porCategoria;

                    return (
                      <tr key={fila.id} className="hover:bg-gray-50">
                        {/* Categoría */}
                        <td className="px-4 py-2 min-w-[140px]">
                          <select
                            value={fila.categoria_id ?? ''}
                            onChange={e => {
                              const catId = e.target.value === '' ? null : Number(e.target.value);
                              updateFila(fila.id, 'categoria_id', catId);
                              updateFila(fila.id, 'marca', null);
                              updateFila(fila.id, 'producto_id', null);
                            }}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                          >
                            <option value="">Todas</option>
                            {categorias.map(c => (
                              <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                          </select>
                        </td>

                        {/* Marca */}
                        <td className="px-4 py-2 hidden md:table-cell min-w-[120px]">
                          <select
                            value={fila.marca ?? ''}
                            onChange={e => {
                              updateFila(fila.id, 'marca', e.target.value || null);
                              updateFila(fila.id, 'producto_id', null);
                            }}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                          >
                            <option value="">Todas</option>
                            {marcasDisponibles.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </td>

                        {/* Producto */}
                        <td className="px-4 py-2 min-w-[200px]">
                          <select
                            value={fila.producto_id ?? ''}
                            onChange={e => {
                              const prodId = e.target.value === '' ? null : Number(e.target.value);
                              updateFila(fila.id, 'producto_id', prodId);
                              if (prodId !== null) {
                                const prod = productos.find(p => p.id === prodId);
                                if (prod?.precio_compra != null) {
                                  updateFila(fila.id, 'costo_unitario', Number(prod.precio_compra));
                                }
                              }
                            }}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                          >
                            <option value="">Producto</option>
                            {productosFiltrados.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} — Stock: {p.stock}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Cantidad */}
                        <td className="px-4 py-2 min-w-[80px]">
                          <input
                            type="number"
                            min={1}
                            value={fila.cantidad}
                            onChange={e => updateFila(fila.id, 'cantidad', Math.max(1, Number(e.target.value)))}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm text-right"
                          />
                        </td>

                        {/* Costo Unitario */}
                        <td className="px-4 py-2 hidden sm:table-cell min-w-[110px]">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={fila.costo_unitario}
                            onChange={e => updateFila(fila.id, 'costo_unitario', Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm text-right"
                          />
                        </td>

                        {/* Subtotal */}
                        <td className="px-4 py-2 text-right font-medium text-gray-900 whitespace-nowrap">
                          Bs {subtotal.toFixed(2)}
                        </td>

                        {/* Eliminar */}
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => removeFila(fila.id)}
                            disabled={filas.length === 1}
                            className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right font-semibold text-gray-700">Total:</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700 text-base whitespace-nowrap">
                      Bs {totalCompra.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Feedback + submit */}
          {compraError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {compraError}
            </div>
          )}
          {compraSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> {compraSuccess}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingCompra}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {savingCompra ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              {savingCompra ? 'Registrando…' : 'Registrar Compra'}
            </button>
          </div>
        </form>
      )}

      {/* ══ TAB: HISTORIAL ══════════════════════════════════════════════════ */}
      {tab === 'historial' && (
        <div className="space-y-4">
          {/* Filtros + botones de exportación */}
          <div className="bg-white rounded-xl border border-gray-200 px-4 sm:px-6 py-4 flex flex-col xl:flex-row items-start xl:items-center gap-3">
            {/* Rango de fechas */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Rango de fechas:</span>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">Desde</label>
                <input type="date" value={histDesde} onChange={e => setHistDesde(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">Hasta</label>
                <input type="date" value={histHasta} onChange={e => setHistHasta(e.target.value)}
                  min={histDesde}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Filtro de proveedor */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Proveedor:</label>
              <select
                value={histProveedor}
                onChange={e => setHistProveedor(e.target.value === '' ? '' : Number(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white min-w-[180px]"
              >
                <option value="">Todos los proveedores</option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre_empresa}</option>
                ))}
              </select>
            </div>

            {/* Botón limpiar filtros */}
            {(histDesde || histHasta || histProveedor !== '') && (
              <button
                onClick={() => { setHistDesde(''); setHistHasta(''); setHistProveedor(''); }}
                className="text-xs text-red-500 hover:text-red-700 hover:underline whitespace-nowrap"
              >
                Limpiar filtros
              </button>
            )}

            {/* Botones de exportación */}
            <div className="flex items-center gap-2 xl:ml-auto">
              <button
                onClick={descargarExcel}
                disabled={comprasFiltradas.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                title="Descargar reporte en formato Excel (CSV)"
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
              <button
                onClick={descargarPDF}
                disabled={comprasFiltradas.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                title="Descargar reporte en formato PDF"
              >
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>

          {loadingHist ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando historial…
            </div>
          ) : comprasFiltradas.length === 0 ? (
            <div className="bg-white rounded-xl p-12 border border-gray-200 text-center text-gray-500">
              <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>{compras.length === 0 ? 'No hay compras registradas aún.' : 'No hay compras en ese rango de fechas.'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Encabezado de columnas */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>Compra</span>
                <span>Proveedor</span>
                <span className="hidden sm:block">Fecha</span>
                <span className="hidden md:block">Productos</span>
                <span>Total</span>
              </div>

            {comprasFiltradas.map(compra => (
              <div key={compra.id} className="border-b border-gray-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === compra.id ? null : compra.id)}
                  className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors gap-2"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-left flex-1">
                    <p className="font-semibold text-gray-900">#{compra.id}</p>
                    <p className="font-medium text-gray-800 truncate max-w-[140px] sm:max-w-none">{compra.proveedor_nombre}</p>
                    <p className="hidden sm:block text-gray-700 text-sm">
                      {new Date(compra.fecha_compra).toLocaleDateString('es-BO')}
                    </p>
                    <p className="hidden md:block text-gray-700 text-sm">{compra.detalles?.length ?? 0} ítem(s)</p>
                    <p className="font-bold text-blue-700">Bs {Number(compra.monto_total).toFixed(2)}</p>
                  </div>
                  {expandedId === compra.id
                    ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                </button>

                {expandedId === compra.id && (
                  <div className="border-t border-gray-200 bg-gray-50 px-4 sm:px-6 py-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs uppercase tracking-wide">
                          <th className="text-left py-2 font-medium">Producto</th>
                          <th className="text-right py-2 font-medium">Cant.</th>
                          <th className="hidden sm:table-cell text-right py-2 font-medium">Costo Unit.</th>
                          <th className="text-right py-2 font-medium">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(compra.detalles ?? []).map(d => (
                          <tr key={d.id}>
                            <td className="py-2 text-gray-800">{d.producto_nombre}</td>
                            <td className="py-2 text-right text-gray-700">{d.cantidad}</td>
                            <td className="hidden sm:table-cell py-2 text-right text-gray-700">Bs {Number(d.costo_unitario).toFixed(2)}</td>
                            <td className="py-2 text-right font-medium text-gray-900">
                              Bs {(d.cantidad * Number(d.costo_unitario)).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

              {/* Fila de total general */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 px-4 sm:px-6 py-3 bg-blue-50 border-t-2 border-blue-200">
                <span className="col-span-1 sm:col-span-2 md:col-span-4 text-right text-sm font-semibold text-gray-700">Monto Total:</span>
                <span className="font-bold text-blue-700">
                  Bs {totalGeneral.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ MODAL Proveedor ════════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitProv} className="p-5 space-y-4 overflow-y-auto">
              {/* Empresa + NIT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Empresa *</label>
                  <input
                    type="text"
                    value={provForm.nombre_empresa}
                    onChange={e => setProvField('nombre_empresa', e.target.value)}
                    placeholder="Distribuidora Tech S.R.L."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIT *</label>
                  <input
                    type="text"
                    value={provForm.nit}
                    onChange={e => setProvField('nit', e.target.value)}
                    placeholder="12345678"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    required
                  />
                </div>
              </div>

              {/* Razón Social */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social</label>
                <input
                  type="text"
                  value={provForm.razon_social}
                  onChange={e => setProvField('razon_social', e.target.value)}
                  placeholder="Nombre legal completo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Contacto + Teléfono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Contacto</label>
                  <input
                    type="text"
                    value={provForm.contacto_nombre}
                    onChange={e => setProvField('contacto_nombre', e.target.value)}
                    placeholder="Juan Pérez"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={provForm.telefono}
                    onChange={e => setProvField('telefono', e.target.value)}
                    placeholder="70000000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Correo + Ciudad */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
                  <input
                    type="email"
                    value={provForm.correo}
                    onChange={e => setProvField('correo', e.target.value)}
                    placeholder="contacto@empresa.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={provForm.ciudad}
                    onChange={e => setProvField('ciudad', e.target.value)}
                    placeholder="Santa Cruz"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Dirección */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <textarea
                  value={provForm.direccion}
                  onChange={e => setProvField('direccion', e.target.value)}
                  placeholder="Av. Principal #123"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                />
              </div>

              {/* Activo */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="prov-activo"
                  checked={provForm.activo}
                  onChange={e => setProvField('activo', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="prov-activo" className="text-sm text-gray-700">Proveedor activo</label>
              </div>

              {provError && isModalOpen && (
                <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {provError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProv}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {savingProv && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? 'Guardar cambios' : 'Crear proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
