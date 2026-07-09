/**
 * Orders.tsx - Mis Pedidos (Vista del Cliente)
 *
 * Página exclusiva para clientes donde pueden ver el historial de sus compras online.
 * Solo muestra las ventas que pertenecen al cliente logueado (filtradas por cliente_id).
 *
 * FUNCIONALIDADES:
 * - Lista de pedidos con estado (Pendiente, Completado, Cancelado)
 * - Detalle expandido de cada pedido (productos, cantidades, pago)
 * - Garantía por producto (fechas + estado) y botón "Reclamar" en pedidos entregados
 * - Descarga de factura PDF para pedidos completados
 *
 * GARANTÍAS:
 * - Cada producto comprado tiene su garantía (si el producto la define en meses).
 * - El botón "Reclamar" solo aparece en pedidos Completados (ya entregados) y
 *   mientras la garantía esté vigente. El cliente describe el problema y el
 *   reclamo queda registrado para que el vendedor/admin lo atienda en tienda.
 */
import { useState, useEffect } from 'react';
import { Package, Eye, X, FileText, ShieldCheck, Star, Wrench, RotateCcw } from 'lucide-react';

const SERV_ESTADO: Record<string, { label: string; cls: string }> = {
  solicitado: { label: 'Solicitado', cls: 'bg-gray-100 text-gray-700' },
  agendado:   { label: 'Agendado',   cls: 'bg-yellow-100 text-yellow-700' },
  en_proceso: { label: 'En proceso', cls: 'bg-blue-100 text-blue-700' },
  finalizado: { label: 'Finalizado', cls: 'bg-green-100 text-green-700' },
  entregado:  { label: 'Entregado',  cls: 'bg-emerald-100 text-emerald-700' },
  cancelado:  { label: 'Cancelado',  cls: 'bg-red-100 text-red-600' },
};
const formatFechaServ = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
import { useEscapeKey } from '../hooks/useEscapeKey';
import { ventasAPI, garantiasAPI, resenasAPI, servicioTecnicoAPI, devolucionesAPI, API_BASE_URL, BACKEND_ROOT_URL, ApiVenta, ApiGarantia, ApiResena, ApiOrdenServicio } from '../services/api';
import { StarRating } from '../components/StarRating';
import { useAuth } from '../context/AuthContext';

export function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ApiVenta[]>([]);
  const [garantias, setGarantias] = useState<ApiGarantia[]>([]);
  const [resenas, setResenas] = useState<ApiResena[]>([]);
  const [servicios, setServicios] = useState<ApiOrdenServicio[]>([]);
  const [devoluciones, setDevoluciones] = useState<any[]>([]);
  const [servHistorialAbierto, setServHistorialAbierto] = useState(false);
  const [servDetalle, setServDetalle] = useState<ApiOrdenServicio | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<ApiVenta | null>(null);

  // Calificación del pedido seleccionado
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComentario, setRatingComentario] = useState('');
  const [enviandoResena, setEnviandoResena] = useState(false);
  const [resenaError, setResenaError] = useState('');

  // Estado del modal de reclamo
  const [reclamarTarget, setReclamarTarget] = useState<ApiGarantia | null>(null);
  const [motivo, setMotivo] = useState('');
  const [reclamando, setReclamando] = useState(false);
  const [reclamoError, setReclamoError] = useState('');

  const cargarGarantias = (clienteId: number) =>
    garantiasAPI.getByCliente(clienteId).then(setGarantias).catch(() => setGarantias([]));

  const cargarResenas = (clienteId: number) =>
    resenasAPI.getByCliente(clienteId).then(setResenas).catch(() => setResenas([]));

  // Al montar el componente, carga las ventas, garantías, reseñas y devoluciones del cliente
  useEffect(() => {
    if (!user) return;
    const clienteId = parseInt(user.id);
    Promise.all([
      ventasAPI.getByCliente(clienteId).then(setOrders).catch(() => setOrders([])),
      cargarGarantias(clienteId),
      cargarResenas(clienteId),
      servicioTecnicoAPI.ordenes({ cliente: clienteId }).then(setServicios).catch(() => setServicios([])),
      devolucionesAPI.getByCliente(clienteId).then(setDevoluciones).catch(() => setDevoluciones([])),
    ]).finally(() => setLoading(false));
  }, [user]);

  // Reseña del pedido (si ya fue calificado)
  const resenaDeVenta = (ventaId: number) => resenas.find(r => r.venta === ventaId);

  // Abrir detalle: resetear el formulario de calificación
  const abrirDetalle = (order: ApiVenta) => {
    setSelectedOrder(order);
    setRatingValue(0);
    setRatingComentario('');
    setResenaError('');
  };

  const enviarResena = async () => {
    if (!selectedOrder || !user) return;
    if (ratingValue < 1) { setResenaError('Selecciona una puntuación de 1 a 5 estrellas.'); return; }
    setEnviandoResena(true);
    setResenaError('');
    try {
      await resenasAPI.create({
        cliente: parseInt(user.id),
        venta: selectedOrder.id,
        puntuacion: ratingValue,
        comentario: ratingComentario.trim() || undefined,
      });
      await cargarResenas(parseInt(user.id));
    } catch (err: any) {
      setResenaError(err.message || 'No se pudo enviar la calificación.');
    } finally {
      setEnviandoResena(false);
    }
  };

  // Mapa: id del detalle (ítem) → su garantía
  const garantiaPorDetalle: Record<number, ApiGarantia> = {};
  garantias.forEach(g => { garantiaPorDetalle[g.detalle] = g; });

  // Mapa: id del detalle (ítem) → devoluciones asociadas (puede haber más de una)
  const devolucionesPorDetalle: Record<number, any[]> = {};
  devoluciones.forEach(d => {
    if (!devolucionesPorDetalle[d.detalle]) devolucionesPorDetalle[d.detalle] = [];
    devolucionesPorDetalle[d.detalle].push(d);
  });

  // Devoluciones agrupadas por venta (para el pill de la card principal)
  const devolucionesPorVenta = (ventaId: number) => devoluciones.filter(d => d.venta === ventaId);

  // Formato del número de comprobante RMA a partir de la fecha + id
  const nroComprobante = (d: any) => {
    const anio = new Date(d.fecha).getFullYear();
    return `RMA-${anio}-${String(d.id).padStart(6, '0')}`;
  };

  // Devuelve una etiqueta visual de color según el estado del pedido
  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
      processing: { label: 'Procesando', color: 'bg-blue-100 text-blue-700' },
      completed: { label: 'Completado', color: 'bg-green-100 text-green-700' },
      cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
    };
    const s = map[status] ?? { label: status, color: 'bg-gray-100 text-gray-700' };
    return <span className={`px-3 py-1 rounded-full text-sm font-medium ${s.color}`}>{s.label}</span>;
  };

  // Texto del tiempo restante de garantía
  const restante = (dias: number) => {
    if (dias <= 0) return '';
    if (dias < 30) return `quedan ${dias} día${dias === 1 ? '' : 's'}`;
    const meses = Math.round(dias / 30);
    return `quedan ~${meses} mes${meses === 1 ? '' : 'es'}`;
  };

  // Badge visual del estado de la garantía
  const garantiaBadge = (g: ApiGarantia) => {
    const map: Record<string, { label: string; color: string }> = {
      vigente:   { label: `🟢 Vigente${g.dias_restantes ? ` (${restante(g.dias_restantes)})` : ''}`, color: 'text-green-700' },
      vencida:   { label: '⚪ Vencida', color: 'text-gray-500' },
      reclamada: { label: '🟡 En reclamo', color: 'text-yellow-700' },
      aprobada:  { label: '🔵 Reclamo aprobado', color: 'text-blue-700' },
      rechazada: { label: '🔴 Reclamo rechazado', color: 'text-red-600' },
      anulada:   { label: '🚫 Garantía anulada', color: 'text-gray-600' },
    };
    const s = map[g.estado_efectivo] ?? { label: g.estado_efectivo, color: 'text-gray-600' };
    return <span className={`text-xs font-semibold ${s.color}`}>{s.label}</span>;
  };

  const formatFecha = (f: string) => {
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y.slice(2)}`;
  };

  const abrirReclamo = (g: ApiGarantia) => {
    setReclamarTarget(g);
    setMotivo('');
    setReclamoError('');
  };

  const enviarReclamo = async () => {
    if (!reclamarTarget) return;
    if (!motivo.trim()) { setReclamoError('Describe el problema del producto.'); return; }
    setReclamando(true);
    setReclamoError('');
    try {
      await garantiasAPI.reclamar(reclamarTarget.id, motivo.trim());
      if (user) await cargarGarantias(parseInt(user.id));
      setReclamarTarget(null);
    } catch (err: any) {
      setReclamoError(err.message || 'No se pudo enviar el reclamo.');
    } finally {
      setReclamando(false);
    }
  };

  // Cerrar modales con Esc
  useEscapeKey(!!selectedOrder, () => setSelectedOrder(null));
  useEscapeKey(!!reclamarTarget, () => setReclamarTarget(null));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis Pedidos</h1>
        <p className="text-gray-600">Historial de compras, garantías y seguimiento</p>
      </div>

      {/* CU25/26/27: Servicios técnicos agrupados por estado */}
      {servicios.length > 0 && (() => {
        const hoy = new Date().toISOString().slice(0, 10);
        const listos    = servicios.filter(s => s.estado === 'finalizado');
        const enProceso = servicios.filter(s => ['solicitado', 'agendado', 'en_proceso'].includes(s.estado));
        const historial = servicios.filter(s => ['entregado', 'cancelado'].includes(s.estado));

        const cardServicio = (s: ApiOrdenServicio) => {
          const abierto = servDetalle?.id === s.id;
          const adelantado = s.estado === 'finalizado' && s.fecha_entrega_prevista && s.fecha_entrega_prevista.slice(0, 10) > hoy;
          const tareasHechas = s.tareas.filter(t => t.realizado);
          return (
            <div key={s.id} className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">
                    #{s.id} · {s.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo'} · {s.equipo}
                  </p>
                  {s.estado === 'finalizado' && (
                    <p className="text-sm text-green-700 font-medium mt-1">
                      {adelantado
                        ? `✨ Adelantado — podés retirarlo desde HOY (original: ${formatFechaServ(s.fecha_entrega_prevista!)})`
                        : 'Listo para retirar HOY'}
                    </p>
                  )}
                  {s.estado === 'agendado' && s.fecha_entrega_prevista && (
                    <p className="text-sm text-yellow-700 font-medium mt-1">
                      📅 Retiro previsto: {formatFechaServ(s.fecha_entrega_prevista)}
                    </p>
                  )}
                  {s.estado === 'solicitado' && (
                    <p className="text-sm text-gray-500 mt-1">Solicitado — el técnico va a asignar fecha pronto</p>
                  )}
                  {s.estado === 'en_proceso' && (
                    <p className="text-sm text-blue-700 mt-1">
                      ⚙️ En proceso{s.fecha_entrega_prevista ? ` · retiro previsto: ${formatFechaServ(s.fecha_entrega_prevista)}` : ''}
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
                  <p className="text-sm font-bold text-gray-900 mt-1">
                    {s.es_beneficio ? 'GRATIS' : `Bs ${Number(s.costo_total).toFixed(2)}`}
                  </p>
                </div>
              </div>
              {/* Detalle expandible: solo en listos (útil para saber qué se hizo antes de retirar) */}
              {s.estado === 'finalizado' && (s.detalles.length > 0 || tareasHechas.length > 0) && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <button onClick={() => setServDetalle(abierto ? null : s)}
                    className="text-xs text-blue-600 hover:underline">
                    {abierto ? '▼ Ocultar detalle del servicio' : '▶ Ver detalle del servicio'}
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

        return (
          <div className="space-y-4">
            {/* Listo para retirar */}
            {listos.length > 0 && (
              <div className="bg-green-50 rounded-xl p-4 border-2 border-green-300">
                <h2 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  ✅ Listo para retirar ({listos.length})
                </h2>
                <div className="space-y-2">{listos.map(cardServicio)}</div>
              </div>
            )}

            {/* En proceso */}
            {enProceso.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-yellow-600" /> En proceso ({enProceso.length})
                </h2>
                <div className="space-y-2">{enProceso.map(cardServicio)}</div>
              </div>
            )}

            {/* Historial (colapsable) */}
            {historial.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <button onClick={() => setServHistorialAbierto(!servHistorialAbierto)}
                  className="w-full flex items-center justify-between text-left">
                  <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                    📚 Historial ({historial.length} servicio{historial.length === 1 ? '' : 's'} anterior{historial.length === 1 ? '' : 'es'})
                  </h2>
                  <span className="text-blue-600 text-sm">
                    {servHistorialAbierto ? '▼ Ocultar' : '▶ Ver historial completo'}
                  </span>
                </button>
                {servHistorialAbierto && (
                  <div className="space-y-2 mt-3">{historial.map(cardServicio)}</div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No tienes pedidos aún</h3>
          <p className="text-gray-600">Tus compras aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">Pedido #{order.id}</h3>
                    {getStatusBadge(order.status)}
                    {order.es_credito && (
                      <a href="/mis-creditos"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200">
                        💳 Al crédito · Ver en Mis Créditos
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Fecha: {new Date(order.fecha).toLocaleDateString('es-BO')}
                  </p>
                </div>
                <div className="flex items-center gap-4 mt-4 md:mt-0">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="text-xl font-bold text-gray-900">{parseFloat(String(order.total)).toFixed(2)} Bs</p>
                  </div>
                  <button onClick={() => abrirDetalle(order)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Eye className="w-4 h-4" /> Ver Detalles
                  </button>
                </div>
              </div>

              {order.detalles && order.detalles.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                  {order.detalles.map(d => (
                    <span key={d.id} className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded">
                      {d.producto_name} × {d.cantidad}
                    </span>
                  ))}
                </div>
              )}

              {/* Pill de resumen de devoluciones (CU23) — solo si hay alguna en esta venta */}
              {(() => {
                const devs = devolucionesPorVenta(order.id);
                if (devs.length === 0) return null;
                const aprobadas = devs.filter(d => d.estado === 'aprobada').length;
                const rechazadas = devs.filter(d => d.estado === 'rechazada').length;
                const partes: string[] = [];
                if (aprobadas)  partes.push(`${aprobadas} devolución${aprobadas === 1 ? '' : 'es'} aprobada${aprobadas === 1 ? '' : 's'}`);
                if (rechazadas) partes.push(`${rechazadas} rechazada${rechazadas === 1 ? '' : 's'}`);
                return (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    <span>{partes.join(' · ')}</span>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Detalles del Pedido</h2>
                <p className="text-sm text-gray-600 mt-1">#{selectedOrder.id}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Estado</p>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fecha</p>
                  <p className="font-medium text-gray-900">{new Date(selectedOrder.fecha).toLocaleDateString('es-BO')}</p>
                </div>
              </div>

              {selectedOrder.detalles && selectedOrder.detalles.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Productos</h3>
                  <div className="space-y-3">
                    {selectedOrder.detalles.map(d => {
                      const g = garantiaPorDetalle[d.id];
                      return (
                        <div key={d.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                          <div className="w-14 h-14 bg-blue-50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                            {d.producto_imagen
                              ? <img
                                  src={d.producto_imagen.startsWith('http') ? d.producto_imagen : `${BACKEND_ROOT_URL}${d.producto_imagen}`}
                                  alt={d.producto_name}
                                  className="w-full h-full object-cover"
                                />
                              : <Package className="w-6 h-6 text-blue-300" />
                            }
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{d.producto_name}</h4>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-sm text-gray-600">Cantidad: {d.cantidad}</span>
                              <span className="font-semibold text-gray-900">{parseFloat(String(d.subtotal)).toFixed(2)} Bs</span>
                            </div>

                            {/* Garantía del producto */}
                            {g && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                                  <span>Garantía: {formatFecha(g.fecha_inicio)} – {formatFecha(g.fecha_fin)}</span>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  {garantiaBadge(g)}
                                  {/* Reclamar: solo en pedidos entregados y con garantía vigente */}
                                  {selectedOrder.status === 'completed' && g.vigente && (
                                    <button
                                      onClick={() => abrirReclamo(g)}
                                      className="text-xs px-3 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium"
                                    >
                                      Reclamar
                                    </button>
                                  )}
                                </div>
                                {/* Resolución del vendedor/admin (incluye el motivo de anulación por devolución) */}
                                {(g.estado === 'aprobada' || g.estado === 'rechazada' || g.estado === 'anulada') && g.resolucion && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    <span className="font-medium">Detalle:</span> {g.resolucion}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Devoluciones del producto (CU23) */}
                            {(devolucionesPorDetalle[d.id] || []).map((dev: any) => {
                              const esAprobada = dev.estado === 'aprobada';
                              const bg = esAprobada ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
                              const iconColor = esAprobada ? 'text-green-600' : 'text-red-600';
                              return (
                                <div key={dev.id} className={`mt-2 pt-2 border-t border-gray-200`}>
                                  <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <RotateCcw className={`w-4 h-4 ${iconColor}`} />
                                    <span>Devolución solicitada</span>
                                  </div>
                                  <div className={`mt-1 rounded-lg border ${bg} p-2 text-xs`}>
                                    {esAprobada ? (
                                      <>
                                        <p className="font-semibold text-green-800">
                                          🟢 Aprobada — Bs {Number(dev.monto_reembolso).toFixed(2)}
                                          {dev.cantidad > 1 && ` (${dev.cantidad} unidades)`}
                                        </p>
                                        <p className="mt-1 text-gray-700">
                                          📄 <span className="font-medium">Comprobante:</span> {nroComprobante(dev)}
                                        </p>
                                        <p className="mt-1 text-gray-600">
                                          Presenta este comprobante y tu factura en tienda para el reembolso.
                                        </p>
                                      </>
                                    ) : (
                                      <>
                                        <p className="font-semibold text-red-700">🔴 Rechazada</p>
                                        <p className="mt-1 text-gray-700">
                                          📄 <span className="font-medium">Comprobante:</span> {nroComprobante(dev)}
                                        </p>
                                        {dev.motivo_rechazo && (
                                          <p className="mt-1 text-gray-700">
                                            <span className="font-medium">Motivo del rechazo:</span> {dev.motivo_rechazo}
                                          </p>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedOrder.pagos && selectedOrder.pagos.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Pago</h3>
                  {selectedOrder.pagos.map(p => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span className="text-gray-600 capitalize">{p.metodo}</span>
                      <span className="font-medium">{parseFloat(String(p.monto)).toFixed(2)} Bs</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-gray-900">{parseFloat(String(selectedOrder.total)).toFixed(2)} Bs</span>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
                <Package className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Estado del pedido</p>
                  <p className="text-sm text-blue-700 mt-1">
                    {selectedOrder.status === 'completed'
                      ? 'Tu pedido ha sido confirmado y pagado'
                      : selectedOrder.status === 'pending'
                      ? 'Hemos recibido tu pedido, en espera de confirmación'
                      : `Estado: ${selectedOrder.status}`}
                  </p>
                </div>
              </div>

              {selectedOrder.status === 'completed' && (
                <button
                  onClick={() => window.open(`${API_BASE_URL}/orders/ventas/${selectedOrder.id}/pdf/`, '_blank')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  <FileText className="w-5 h-5" />
                  Descargar Factura PDF
                </button>
              )}

              {/* Califica tu compra (solo pedidos completados) */}
              {selectedOrder.status === 'completed' && (() => {
                const yaResena = resenaDeVenta(selectedOrder.id);
                return (
                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                      {yaResena ? 'Tu calificación' : 'Califica tu compra'}
                    </h3>
                    {yaResena ? (
                      <div className="bg-amber-50 rounded-lg p-4 space-y-2">
                        <StarRating value={yaResena.puntuacion} readOnly size={22} />
                        {yaResena.comentario && (
                          <p className="text-sm text-gray-700 italic">"{yaResena.comentario}"</p>
                        )}
                        <p className="text-xs text-gray-500">Gracias por tu opinión. La calificación no se puede modificar.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600">Cuéntanos sobre la atención y la calidad del producto.</p>
                        {resenaError && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{resenaError}</div>
                        )}
                        <StarRating value={ratingValue} onChange={setRatingValue} size={28} />
                        <textarea
                          value={ratingComentario}
                          onChange={e => setRatingComentario(e.target.value)}
                          rows={3}
                          placeholder="Comentario (opcional): atención, calidad del producto..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <button
                          onClick={enviarResena}
                          disabled={enviandoResena}
                          className="w-full px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                        >
                          {enviandoResena ? 'Enviando...' : 'Enviar calificación'}
                        </button>
                        <p className="text-xs text-gray-400">Una vez enviada, la calificación no se puede modificar.</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal de reclamo de garantía */}
      {reclamarTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Reclamar garantía</h2>
                  <p className="text-xs text-gray-500">{reclamarTarget.producto_nombre}</p>
                </div>
              </div>
              <button onClick={() => setReclamarTarget(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Garantía vigente hasta <span className="font-medium">{formatFecha(reclamarTarget.fecha_fin)}</span>.
                Describe el problema del producto (defecto de fábrica, falla, etc.).
              </p>
              {reclamoError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{reclamoError}</div>
              )}
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={4}
                placeholder="Ej: La pantalla parpadea y se apaga sola."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="bg-amber-50 p-3 rounded-lg text-xs text-amber-800">
                Tras enviar el reclamo, acércate a la tienda con el producto y tu comprobante.
                El equipo revisará tu caso.
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setReclamarTarget(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={enviarReclamo} disabled={reclamando}
                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
                  {reclamando ? 'Enviando...' : 'Enviar reclamo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
