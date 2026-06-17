/**
 * Reviews.tsx - Reseñas (Moderación del Admin)
 *
 * Página interna donde el admin ve TODAS las reseñas de los clientes (incluidas
 * las ocultas) y puede moderarlas:
 *  - Ocultar: la reseña deja de verse en la Tienda y no cuenta en el promedio
 *             (no se borra, queda el registro y es reversible).
 *  - Mostrar: vuelve a publicarla.
 * Cada acción queda en la bitácora con el responsable.
 */
import { useState, useEffect } from 'react';
import { MessageSquare, EyeOff, Eye } from 'lucide-react';
import { resenasAPI, ApiResena } from '../services/api';
import { StarRating } from '../components/StarRating';

type Filtro = 'todas' | 'visibles' | 'ocultas';

export function Reviews() {
  const [resenas, setResenas] = useState<ApiResena[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [procesando, setProcesando] = useState<number | null>(null);

  const cargar = () => {
    setLoading(true);
    resenasAPI.getAll()
      .then(setResenas)
      .catch(() => setResenas([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const visibles = resenas.filter(r => {
    if (filtro === 'visibles') return r.estado === 'visible';
    if (filtro === 'ocultas')  return r.estado === 'oculto';
    return true;
  });

  const ocultasCount = resenas.filter(r => r.estado === 'oculto').length;

  const toggle = async (r: ApiResena) => {
    setProcesando(r.id);
    try {
      if (r.estado === 'visible') await resenasAPI.ocultar(r.id);
      else await resenasAPI.mostrar(r.id);
      cargar();
    } catch {
      /* noop */
    } finally {
      setProcesando(null);
    }
  };

  const formatFecha = (f: string) => new Date(f).toLocaleDateString('es-BO');

  const filtros: { key: Filtro; label: string }[] = [
    { key: 'todas',    label: `Todas (${resenas.length})` },
    { key: 'visibles', label: 'Visibles' },
    { key: 'ocultas',  label: `Ocultas${ocultasCount ? ` (${ocultasCount})` : ''}` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-blue-600" /> Reseñas
        </h1>
        <p className="text-gray-600">Opiniones de los clientes — modera las inapropiadas</p>
      </div>

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

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : visibles.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
          <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin reseñas</h3>
          <p className="text-gray-600">No hay reseñas que coincidan con este filtro</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibles.map(r => (
            <div
              key={r.id}
              className={`bg-white rounded-xl p-5 border ${r.estado === 'oculto' ? 'border-red-200 opacity-70' : 'border-gray-200'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <StarRating value={r.puntuacion} readOnly size={18} />
                    <span className="text-sm font-medium text-gray-900">{r.cliente_nombre}</span>
                    <span className="text-xs text-gray-400">· Pedido #{r.venta} · {formatFecha(r.fecha)}</span>
                    {r.estado === 'oculto' && (
                      <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Oculta</span>
                    )}
                  </div>
                  {r.comentario
                    ? <p className="text-sm text-gray-700">"{r.comentario}"</p>
                    : <p className="text-sm text-gray-400 italic">Sin comentario</p>}
                </div>
                <button
                  onClick={() => toggle(r)}
                  disabled={procesando === r.id}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 ${
                    r.estado === 'visible'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {r.estado === 'visible'
                    ? <><EyeOff className="w-3.5 h-3.5" /> Ocultar</>
                    : <><Eye className="w-3.5 h-3.5" /> Mostrar</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
