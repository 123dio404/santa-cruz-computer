/**
 * MisServicios.tsx — Vista del CLIENTE con sus servicios técnicos (CU25/26/27)
 *
 * Página separada de Mis Pedidos para dar formalidad al historial de
 * mantenimientos del equipo del cliente. Se organiza en 3 subsecciones:
 *
 *   ✅ Listo para retirar (finalizados)
 *   ⚙️ En proceso (agendado / en_proceso / solicitado — legacy)
 *   📚 Historial (entregados / cancelados)
 *
 * Cada card muestra el modelo del producto vinculado (producto_referencia_nombre)
 * en lugar del genérico "laptop" / "escritorio", y el costo destacado en verde
 * si fue GRATIS por garantía.
 */
import { useEffect, useState } from 'react';
import { Wrench, CheckCircle, Package, Calendar } from 'lucide-react';
import { servicioTecnicoAPI, ApiOrdenServicio } from '../services/api';

const SERV_ESTADO: Record<string, { label: string; cls: string }> = {
  solicitado: { label: 'Solicitado', cls: 'bg-gray-100 text-gray-700' },
  agendado:   { label: 'Agendado',   cls: 'bg-yellow-100 text-yellow-700' },
  en_proceso: { label: 'En proceso', cls: 'bg-blue-100 text-blue-700' },
  finalizado: { label: 'Finalizado', cls: 'bg-green-100 text-green-700' },
  entregado:  { label: 'Entregado',  cls: 'bg-emerald-100 text-emerald-700' },
  cancelado:  { label: 'Cancelado',  cls: 'bg-red-100 text-red-600' },
};

const formatFecha = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export function MisServicios() {
  const [servicios, setServicios] = useState<ApiOrdenServicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalleAbierto, setDetalleAbierto] = useState<number | null>(null);
  const [historialAbierto, setHistorialAbierto] = useState(false);

  useEffect(() => {
    servicioTecnicoAPI.ordenes()
      .then(setServicios)
      .catch(() => setServicios([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  const hoy = new Date().toISOString().slice(0, 10);
  const listos    = servicios.filter(s => s.estado === 'finalizado');
  const enProceso = servicios.filter(s => ['solicitado', 'agendado', 'en_proceso'].includes(s.estado));
  const historial = servicios.filter(s => ['entregado', 'cancelado'].includes(s.estado));

  const renderCard = (s: ApiOrdenServicio) => {
    const abierto = detalleAbierto === s.id;
    const adelantado = s.estado === 'finalizado' && s.fecha_entrega_prevista && s.fecha_entrega_prevista.slice(0, 10) > hoy;
    const tareasHechas = s.tareas.filter(t => t.realizado);
    // Título prioriza el nombre del producto vinculado (MSI Bravo 15) sobre
    // el genérico "laptop" / "escritorio". Igual a lo que ve el técnico.
    const nombreEquipo = s.producto_referencia_nombre || s.equipo;
    const tieneDetalle = s.detalles.length > 0 || tareasHechas.length > 0 || s.observaciones;
    return (
      <div key={s.id} className="border border-gray-200 rounded-lg p-3 bg-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900">
              <span className="text-xs text-gray-500 font-normal">#{s.id}</span>{' · '}
              {s.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo'}{' · '}
              <span className="text-blue-700">{nombreEquipo}</span>
            </p>
            {s.producto_referencia_marca && (
              <p className="text-xs text-gray-500">{s.producto_referencia_marca}</p>
            )}
            {s.estado === 'finalizado' && (
              <p className="text-sm text-green-700 font-medium mt-1">
                {adelantado
                  ? `✨ Adelantado — podés retirarlo desde HOY (original: ${formatFecha(s.fecha_entrega_prevista!)})`
                  : 'Listo para retirar HOY'}
              </p>
            )}
            {s.estado === 'agendado' && s.fecha_entrega_prevista && (
              <p className="text-sm text-yellow-700 font-medium mt-1">
                📅 Retiro previsto: {formatFecha(s.fecha_entrega_prevista)}
              </p>
            )}
            {s.estado === 'solicitado' && (
              <p className="text-sm text-gray-500 mt-1">Solicitado — el técnico va a asignar fecha pronto</p>
            )}
            {s.estado === 'en_proceso' && (
              <p className="text-sm text-blue-700 mt-1">
                ⚙️ En proceso{s.fecha_entrega_prevista ? ` · retiro previsto: ${formatFecha(s.fecha_entrega_prevista)}` : ''}
              </p>
            )}
            {s.estado === 'entregado' && s.fecha_entrega_real && (
              <p className="text-sm text-gray-500 mt-1">
                Entregado el {new Date(s.fecha_entrega_real).toLocaleDateString('es-BO')}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SERV_ESTADO[s.estado]?.cls ?? ''}`}>
              {SERV_ESTADO[s.estado]?.label ?? s.estado}
            </span>
            {s.es_beneficio ? (
              <p className="text-sm font-bold text-emerald-700 mt-1">GRATIS</p>
            ) : (
              <p className="text-sm font-bold text-gray-900 mt-1">Bs {Number(s.costo_total).toFixed(2)}</p>
            )}
          </div>
        </div>

        {/* Detalle expandible — visible en finalizado (para saber qué se le hizo antes de retirar)
            y también en entregado (para consultar el historial después) */}
        {(s.estado === 'finalizado' || s.estado === 'entregado') && tieneDetalle && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <button onClick={() => setDetalleAbierto(abierto ? null : s.id)}
              className="text-xs text-blue-600 hover:underline">
              {abierto ? '▼ Ocultar detalle' : '▶ Ver detalle del servicio'}
            </button>
            {abierto && (
              <div className="mt-2 text-xs text-gray-700 space-y-1">
                {s.detalles.length > 0 && (
                  <div>
                    <p className="font-semibold">Trabajos realizados:</p>
                    <ul className="ml-5 list-disc">
                      {s.detalles.map(d => <li key={d.id}>{d.servicio_nombre}</li>)}
                      {tareasHechas.map(t => <li key={t.id}>{t.tarea}</li>)}
                    </ul>
                  </div>
                )}
                {s.observaciones && (
                  <p><span className="font-semibold">Notas del técnico:</span> {s.observaciones}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const totalServicios = servicios.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Wrench className="w-6 h-6 text-emerald-600" /> Mis Servicios
        </h1>
        <p className="text-gray-600">Mantenimientos preventivos y correctivos de tus equipos</p>
      </div>

      {totalServicios === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
          <Wrench className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Todavía no tenés servicios</h3>
          <p className="text-gray-600">
            Cuando lleves tu equipo a mantenimiento, vas a ver acá el estado y podrás
            consultar el historial de todo lo que se le hizo.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Resumen chico arriba */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{listos.length}</div>
              <div className="text-xs text-gray-500">Listos para retirar</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{enProceso.length}</div>
              <div className="text-xs text-gray-500">En proceso</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-gray-700">{historial.length}</div>
              <div className="text-xs text-gray-500">Historial</div>
            </div>
          </div>

          {/* Listo para retirar */}
          {listos.length > 0 && (
            <div className="bg-green-50 rounded-xl p-4 border-2 border-green-300">
              <h2 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" /> Listo para retirar ({listos.length})
              </h2>
              <div className="space-y-2">{listos.map(renderCard)}</div>
            </div>
          )}

          {/* En proceso */}
          {enProceso.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-yellow-600" /> En proceso ({enProceso.length})
              </h2>
              <div className="space-y-2">{enProceso.map(renderCard)}</div>
            </div>
          )}

          {/* Historial (colapsable). Si es lo único que hay, se abre por default */}
          {historial.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <button onClick={() => setHistorialAbierto(!historialAbierto)}
                className="w-full flex items-center justify-between text-left">
                <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                  <Package className="w-5 h-5 text-gray-500" />
                  Historial ({historial.length} servicio{historial.length === 1 ? '' : 's'} anterior{historial.length === 1 ? '' : 'es'})
                </h2>
                <span className="text-blue-600 text-sm">
                  {historialAbierto ? '▼ Ocultar' : '▶ Ver historial'}
                </span>
              </button>
              {/* Se abre automáticamente si es lo único que hay (cliente sin nada activo) */}
              {(historialAbierto || (listos.length === 0 && enProceso.length === 0)) && (
                <div className="space-y-2 mt-3">{historial.map(renderCard)}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
