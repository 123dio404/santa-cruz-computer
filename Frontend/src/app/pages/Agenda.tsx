/**
 * Agenda.tsx — Vista del técnico con las órdenes agendadas y en proceso,
 * agrupadas por fecha_entrega_prevista y ordenadas cronológicamente.
 *
 * Muestra un vistazo rápido de qué tiene que estar listo cada día. Desde
 * cada card se puede tocar "Iniciar" (agendado → en proceso) o "Finalizar"
 * (en proceso → finalizado) sin necesidad de abrir el detalle.
 */
import { useEffect, useState } from 'react';
import { Calendar, Wrench, CheckCircle } from 'lucide-react';
import { servicioTecnicoAPI, ApiOrdenServicio } from '../services/api';

const formatFechaLarga = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString('es-BO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};
const esHoy = (iso: string) => iso.slice(0, 10) === new Date().toISOString().slice(0, 10);

const ESTADO_BADGE: Record<string, { label: string; cls: string; icon: string }> = {
  agendado:   { label: 'Agendado',   cls: 'bg-yellow-100 text-yellow-700', icon: '🕒' },
  en_proceso: { label: 'En proceso', cls: 'bg-blue-100 text-blue-700',     icon: '⚙️' },
};

export function Agenda() {
  const [ordenes, setOrdenes] = useState<ApiOrdenServicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState<{ ok: boolean; text: string } | null>(null);

  const cargar = () => {
    setLoading(true);
    servicioTecnicoAPI.ordenes()
      .then(all => {
        // Solo interesan agendado y en_proceso, y solo si tienen fecha_entrega_prevista
        const filtradas = all.filter(o =>
          (o.estado === 'agendado' || o.estado === 'en_proceso') && o.fecha_entrega_prevista,
        );
        setOrdenes(filtradas);
      })
      .catch(() => setOrdenes([]))
      .finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  const mostrarToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3500);
  };

  const iniciar = async (o: ApiOrdenServicio) => {
    try {
      await servicioTecnicoAPI.cambiarEstado(o.id, { estado: 'en_proceso' });
      cargar();
      mostrarToast(true, `Orden #${o.id} iniciada.`);
    } catch (e) {
      mostrarToast(false, e instanceof Error ? e.message : 'No se pudo iniciar.');
    }
  };

  const finalizar = async (o: ApiOrdenServicio) => {
    try {
      await servicioTecnicoAPI.cambiarEstado(o.id, { estado: 'finalizado' });
      cargar();
      mostrarToast(true, `Orden #${o.id} finalizada. Correo enviado al cliente.`);
    } catch (e) {
      mostrarToast(false, e instanceof Error ? e.message : 'No se pudo finalizar.');
    }
  };

  // Agrupar por fecha_entrega_prevista (solo día, ordenado cronológicamente)
  const grupos: Record<string, ApiOrdenServicio[]> = {};
  ordenes.forEach(o => {
    const dia = o.fecha_entrega_prevista!.slice(0, 10);
    if (!grupos[dia]) grupos[dia] = [];
    grupos[dia].push(o);
  });
  const dias = Object.keys(grupos).sort();

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-600" /> Agenda
        </h1>
        <p className="text-gray-600">Órdenes agendadas y en proceso, ordenadas por fecha de retiro</p>
      </div>

      {dias.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay órdenes agendadas</h3>
          <p className="text-gray-600">Cuando agendes una orden en "Mis Trabajos", aparecerá acá.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {dias.map(dia => (
            <div key={dia}>
              <h2 className={`text-sm font-bold uppercase tracking-wider mb-2 ${esHoy(dia) ? 'text-blue-700' : 'text-gray-700'}`}>
                {esHoy(dia) && <span className="mr-2">📌 HOY —</span>}
                {formatFechaLarga(dia)}
              </h2>
              <div className="space-y-2">
                {grupos[dia].map(o => {
                  const badge = ESTADO_BADGE[o.estado] ?? { label: o.estado, cls: 'bg-gray-100 text-gray-700', icon: '·' };
                  return (
                    <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                              {badge.icon} {badge.label}
                            </span>
                            <p className="font-semibold text-gray-900">
                              #{o.id} · {o.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo'} · {o.equipo}
                            </p>
                          </div>
                          <p className="text-sm text-gray-600 truncate">
                            Cliente: {o.cliente_nombre} · {o.es_beneficio ? 'GRATIS' : `Bs ${Number(o.costo_total).toFixed(2)}`}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {o.estado === 'agendado' && (
                            <button onClick={() => iniciar(o)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                              <Wrench className="w-4 h-4" /> Iniciar
                            </button>
                          )}
                          {o.estado === 'en_proceso' && (
                            <button onClick={() => finalizar(o)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                              <CheckCircle className="w-4 h-4" /> Finalizar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-lg shadow-lg border px-4 py-3 text-sm font-medium
                        ${toast.ok
                          ? 'bg-green-50 border-green-200 text-green-800'
                          : 'bg-red-50 border-red-200 text-red-700'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
