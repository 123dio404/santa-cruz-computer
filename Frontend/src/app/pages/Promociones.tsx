/**
 * Promociones.tsx — Gestión de promociones programadas por producto (CU24, admin)
 *
 * El admin crea descuentos (%) sobre un producto con fecha de inicio y fin.
 * Mientras están vigentes, la Tienda muestra y cobra el precio rebajado.
 */
import { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Send } from 'lucide-react';
import { promocionesAPI, productosAPI, ApiPromocion, ApiProduct } from '../services/api';
import { useEscapeKey } from '../hooks/useEscapeKey';

export function Promociones() {
  const [promos, setPromos]       = useState<ApiPromocion[]>([]);
  const [productos, setProductos] = useState<ApiProduct[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ producto: '', porcentaje: '', fecha_inicio: '', fecha_fin: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [enviando, setEnviando] = useState(false);
  const [catSel, setCatSel] = useState('');
  useEscapeKey(modalOpen, () => setModalOpen(false));

  const cargar = () => {
    setLoading(true);
    Promise.all([promocionesAPI.getAll(), productosAPI.getAll()])
      .then(([p, prods]) => { setPromos(p); setProductos(prods); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  // Categorías únicas (de los productos) y productos filtrados por la categoría elegida
  const categorias = Array.from(new Set(productos.map(p => p.categoria_nombre).filter(Boolean))) as string[];
  const productosFiltrados = catSel ? productos.filter(p => p.categoria_nombre === catSel) : productos;

  const productoSel  = productos.find(p => String(p.id) === form.producto);
  const precioNormal = productoSel ? Number((productoSel as any).precio_venta ?? (productoSel as any).price ?? 0) : 0;
  const pct          = Number(form.porcentaje) || 0;
  const precioPromo  = precioNormal * (1 - pct / 100);

  const estadoDe = (pr: ApiPromocion) => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const ini = new Date(pr.fecha_inicio + 'T00:00:00');
    const fin = new Date(pr.fecha_fin + 'T23:59:59');
    if (!pr.activo)  return { txt: 'Inactiva',   cls: 'bg-gray-100 text-gray-600' };
    if (hoy < ini)   return { txt: 'Programada', cls: 'bg-yellow-100 text-yellow-700' };
    if (hoy > fin)   return { txt: 'Vencida',    cls: 'bg-gray-100 text-gray-500' };
    return { txt: 'Vigente', cls: 'bg-green-100 text-green-700' };
  };

  const abrirModal = () => {
    setForm({ producto: '', porcentaje: '', fecha_inicio: '', fecha_fin: '' });
    setCatSel('');
    setError('');
    setModalOpen(true);
  };

  const guardar = async () => {
    if (!form.producto) { setError('Elige un producto.'); return; }
    if (pct <= 0 || pct > 100) { setError('El descuento debe estar entre 1 y 100.'); return; }
    if (!form.fecha_inicio || !form.fecha_fin) { setError('Indica las fechas de vigencia.'); return; }
    if (form.fecha_fin < form.fecha_inicio) { setError('La fecha fin no puede ser antes que la de inicio.'); return; }
    setSaving(true); setError('');
    try {
      await promocionesAPI.create({
        producto: Number(form.producto), porcentaje: pct,
        fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin,
      });
      setModalOpen(false);
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la promoción.');
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar esta promoción?')) return;
    try { await promocionesAPI.remove(id); cargar(); }
    catch { alert('No se pudo eliminar la promoción.'); }
  };

  const enviarOfertas = async () => {
    const vigentes = promos.filter(p => estadoDe(p).txt === 'Vigente').length;
    if (vigentes === 0) { alert('No hay promociones vigentes para enviar.'); return; }
    if (!confirm(`¿Enviar ${vigentes} oferta(s) vigente(s) a todos los clientes por correo y campana?`)) return;
    setEnviando(true);
    try {
      const r = await promocionesAPI.enviarOfertas();
      alert(`✅ Ofertas enviadas a ${r.enviados} cliente(s).`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo enviar las ofertas.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-amber-600" /> Promociones
          </h1>
          <p className="text-gray-600">Descuentos programados por producto</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={enviarOfertas} disabled={enviando}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            title="Envía las ofertas vigentes a todos los clientes (correo + campana)">
            <Send className="w-4 h-4" /> {enviando ? 'Enviando...' : 'Enviar ofertas a clientes'}
          </button>
          <button onClick={abrirModal}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium">
            <Plus className="w-4 h-4" /> Nueva promoción
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : promos.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay promociones. Crea la primera.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Producto</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">Descuento</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium">Precio</th>
                  <th className="hidden sm:table-cell text-center px-4 py-3 text-gray-600 font-medium">Vigencia</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">Estado</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {promos.map(pr => {
                  const est = estadoDe(pr);
                  return (
                    <tr key={pr.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{pr.producto_nombre}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">-{Number(pr.porcentaje)}%</span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="line-through text-gray-400">Bs {Number(pr.precio_normal).toFixed(2)}</span>{' '}
                        <span className="font-semibold text-amber-700">Bs {Number(pr.precio_promocional).toFixed(2)}</span>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-center text-gray-600 whitespace-nowrap">
                        {pr.fecha_inicio} → {pr.fecha_fin}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${est.cls}`}>{est.txt}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => eliminar(pr.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Nueva promoción</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select value={catSel} onChange={e => { setCatSel(e.target.value); setForm({ ...form, producto: '' }); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">— Todas las categorías —</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
                <select value={form.producto} onChange={e => setForm({ ...form, producto: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">— Elige un producto —</option>
                  {productosFiltrados.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {productoSel && <p className="text-xs text-gray-500 mt-1">Precio normal: Bs {precioNormal.toFixed(2)}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descuento (%)</label>
                <input type="number" min={1} max={100} value={form.porcentaje}
                  onChange={e => setForm({ ...form, porcentaje: e.target.value })}
                  className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="ej. 25" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                  <input type="date" value={form.fecha_inicio}
                    onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                  <input type="date" value={form.fecha_fin} min={form.fecha_inicio}
                    onChange={e => setForm({ ...form, fecha_fin: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              {productoSel && pct > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  Vista previa: <span className="line-through text-gray-400">Bs {precioNormal.toFixed(2)}</span>{' → '}
                  <span className="font-bold text-amber-700">Bs {precioPromo.toFixed(2)}</span>
                  <span className="text-gray-500"> (ahorro Bs {(precioNormal - precioPromo).toFixed(2)})</span>
                </div>
              )}

              {error && <div className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            </div>
            <div className="flex gap-2 p-4 border-t border-gray-200">
              <button onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                Cancelar
              </button>
              <button disabled={saving} onClick={guardar}
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
