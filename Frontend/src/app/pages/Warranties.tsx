/**
 * Warranties.tsx - Reclamos de Garantía (Admin y Vendedor)
 *
 * Página interna donde el personal gestiona las garantías y, sobre todo, los
 * reclamos que envían los clientes desde "Mis Pedidos".
 *
 * FUNCIONALIDADES:
 * - Lista de garantías con filtro (reclamos pendientes, vigentes, vencidas, resueltas, todas)
 * - Búsqueda por cliente o número de pedido
 * - Aprobar un reclamo (procede) o Rechazarlo (no procede: producto manipulado, mal uso)
 *   → cada acción queda en la bitácora con el responsable
 * - Verificar al instante si una garantía sigue vigente cuando el cliente llega a la tienda
 * - Botón para generar las garantías de ventas anteriores (retroactivas)
 */
import { useState, useEffect } from 'react';
import { ShieldCheck, Search, Check, X } from 'lucide-react';
import { garantiasAPI, ApiGarantia } from '../services/api';
import { useEscapeKey } from '../hooks/useEscapeKey';

type Filtro = 'reclamos' | 'vigentes' | 'vencidas' | 'resueltas' | 'todas';

const MOTIVOS_RECHAZO = [
  'Producto manipulado / sello roto',
  'Daño físico por mal uso (golpe, líquido)',
  'Fuera de garantía',
  'Otro',
];

export function Warranties() {
  const [garantias, setGarantias] = useState<ApiGarantia[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('reclamos');
  const [busqueda, setBusqueda] = useState('');

  // Modal de resolución (aprobar / rechazar)
  const [target, setTarget] = useState<ApiGarantia | null>(null);
  const [modo, setModo] = useState<'aprobar' | 'rechazar'>('aprobar');
  const [motivoSel, setMotivoSel] = useState(MOTIVOS_RECHAZO[0]);
  const [detalle, setDetalle] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [errorModal, setErrorModal] = useState('');

  const cargar = () => {
    setLoading(true);
    garantiasAPI.getAll()
      .then(setGarantias)
      .catch(() => setGarantias([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const reclamosPendientes = garantias.filter(g => g.estado === 'reclamada').length;

  const coincideFiltro = (g: ApiGarantia) => {
    switch (filtro) {
      case 'reclamos':  return g.estado === 'reclamada';
      case 'vigentes':  return g.estado_efectivo === 'vigente';
      case 'vencidas':  return g.estado_efectivo === 'vencida';
      case 'resueltas': return g.estado === 'aprobada' || g.estado === 'rechazada';
      default:          return true;
    }
  };

  const coincideBusqueda = (g: ApiGarantia) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (
      String(g.venta).includes(q) ||
      (g.cliente_nombre || '').toLowerCase().includes(q) ||
      (g.producto_nombre || '').toLowerCase().includes(q)
    );
  };

  const visibles = garantias.filter(g => coincideFiltro(g) && coincideBusqueda(g));

  const formatFecha = (f: string) => {
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y.slice(2)}`;
  };

  const estadoBadge = (g: ApiGarantia) => {
    const map: Record<string, { label: string; color: string }> = {
      vigente:   { label: 'Vigente',   color: 'bg-green-100 text-green-700' },
      vencida:   { label: 'Vencida',   color: 'bg-gray-100 text-gray-600' },
      reclamada: { label: 'En reclamo', color: 'bg-yellow-100 text-yellow-700' },
      aprobada:  { label: 'Aprobado',  color: 'bg-blue-100 text-blue-700' },
      rechazada: { label: 'Rechazado', color: 'bg-red-100 text-red-700' },
    };
    const s = map[g.estado_efectivo] ?? { label: g.estado_efectivo, color: 'bg-gray-100 text-gray-600' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const abrirResolucion = (g: ApiGarantia, m: 'aprobar' | 'rechazar') => {
    setTarget(g);
    setModo(m);
    setMotivoSel(MOTIVOS_RECHAZO[0]);
    setDetalle('');
    setErrorModal('');
  };

  const confirmarResolucion = async () => {
    if (!target) return;
    setProcesando(true);
    setErrorModal('');
    try {
      if (modo === 'aprobar') {
        await garantiasAPI.aprobar(target.id, detalle.trim());
      } else {
        const texto = `${motivoSel}${detalle.trim() ? ` — ${detalle.trim()}` : ''}`;
        await garantiasAPI.rechazar(target.id, texto);
      }
      setTarget(null);
      cargar();
    } catch (err: any) {
      setErrorModal(err.message || 'No se pudo procesar la resolución.');
    } finally {
      setProcesando(false);
    }
  };


  const filtros: { key: Filtro; label: string }[] = [
    { key: 'todas',     label: 'Todas' },
    { key: 'reclamos',  label: `Reclamos${reclamosPendientes ? ` (${reclamosPendientes})` : ''}` },
    { key: 'vigentes',  label: 'Vigentes' },
    { key: 'vencidas',  label: 'Vencidas' },
    { key: 'resueltas', label: 'Resueltas' },
  ];

  // Cerrar el modal de resolución con Esc
  useEscapeKey(!!target, () => setTarget(null));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-blue-600" /> Reclamos de Garantía
        </h1>
        <p className="text-gray-600">Gestión de garantías y reclamos de los clientes</p>
      </div>

      {/* Filtros + búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {filtros.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filtro === f.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar cliente, pedido o producto"
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-72"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : visibles.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
          <ShieldCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin resultados</h3>
          <p className="text-gray-600">No hay garantías que coincidan con este filtro</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-4 py-3 font-semibold">Pedido</th>
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Garantía</th>
                <th className="px-4 py-3 font-semibold">Motivo del reclamo</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibles.map(g => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">#{g.venta}</td>
                  <td className="px-4 py-3 text-gray-700">{g.producto_nombre}</td>
                  <td className="px-4 py-3 text-gray-700">{g.cliente_nombre || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatFecha(g.fecha_inicio)} – {formatFecha(g.fecha_fin)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">
                    {g.motivo_reclamo
                      ? <span title={g.motivo_reclamo}>{g.motivo_reclamo}</span>
                      : <span className="text-gray-400">—</span>}
                    {g.resolucion && (
                      <p className="text-xs text-gray-400 mt-1">Resolución: {g.resolucion}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{estadoBadge(g)}</td>
                  <td className="px-4 py-3 text-right">
                    {g.estado === 'reclamada' ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => abrirResolucion(g, 'aprobar')}
                          className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
                        >
                          <Check className="w-3.5 h-3.5" /> Aprobar
                        </button>
                        <button
                          onClick={() => abrirResolucion(g, 'rechazar')}
                          className="flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium"
                        >
                          <X className="w-3.5 h-3.5" /> Rechazar
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de resolución */}
      {target && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                {modo === 'aprobar' ? 'Aprobar reclamo' : 'Rechazar reclamo'} — {target.producto_nombre}
              </h2>
              <button onClick={() => setTarget(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {errorModal && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errorModal}</div>
              )}
              {target.motivo_reclamo && (
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Reclamo del cliente:</span> {target.motivo_reclamo}
                </div>
              )}

              {modo === 'rechazar' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Motivo del rechazo</label>
                  <div className="space-y-1">
                    {MOTIVOS_RECHAZO.map(m => (
                      <label key={m} className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="radio" name="motivo" checked={motivoSel === m} onChange={() => setMotivoSel(m)} />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {modo === 'aprobar' ? 'Nota de resolución (opcional)' : 'Detalle'}
                </label>
                <textarea
                  value={detalle}
                  onChange={e => setDetalle(e.target.value)}
                  rows={3}
                  placeholder={modo === 'aprobar' ? 'Ej: Se aprueba el cambio del equipo.' : 'Ej: Carcasa abierta, tornillos forzados.'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setTarget(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  onClick={confirmarResolucion}
                  disabled={procesando}
                  className={`flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${
                    modo === 'aprobar' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {procesando ? 'Procesando...' : modo === 'aprobar' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
