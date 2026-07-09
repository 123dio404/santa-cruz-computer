/**
 * MisTrabajos.tsx — Servicio Técnico (CU25/26/27), vista del técnico.
 *
 * El técnico REGISTRA (con fecha de retiro obligatoria → la orden nace agendada)
 * y EJECUTA las órdenes de servicio. Filtros en tabs con contador, y las órdenes
 * agendadas/en proceso se agrupan por HOY/Mañana/Semana con acciones inline
 * (Iniciar / Finalizar / Marcar entregado) sin abrir modal.
 */
import { useState, useEffect } from 'react';
import { Wrench, Plus, X, CheckCircle, Calendar, PackageCheck } from 'lucide-react';
import {
  servicioTecnicoAPI, clientesAPI,
  ApiOrdenServicio, ApiServicioCatalogo, ApiElegibilidad, ApiCliente,
} from '../services/api';
import { useEscapeKey } from '../hooks/useEscapeKey';

const ESTADOS: Record<string, { label: string; cls: string }> = {
  solicitado: { label: 'Solicitado', cls: 'bg-gray-100 text-gray-700' },
  agendado:   { label: 'Agendado',   cls: 'bg-yellow-100 text-yellow-700' },
  en_proceso: { label: 'En proceso', cls: 'bg-blue-100 text-blue-700' },
  finalizado: { label: 'Finalizado', cls: 'bg-green-100 text-green-700' },
  entregado:  { label: 'Entregado',  cls: 'bg-emerald-100 text-emerald-700' },
  cancelado:  { label: 'Cancelado',  cls: 'bg-red-100 text-red-600' },
};

// Helpers de fecha
const fechaSugerida = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};
const fechaHoy = () => new Date().toISOString().slice(0, 10);
const formatFechaCorta = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Clasifica una fecha ISO en HOY / MAÑANA / SEMANA / DESPUÉS / SIN_FECHA / ATRASADA.
// Se usa para agrupar las cards de Agendado y En proceso.
type Bucket = 'ATRASADA' | 'HOY' | 'MANANA' | 'SEMANA' | 'DESPUES' | 'SIN_FECHA';
const bucketDeFecha = (iso: string | null): Bucket => {
  if (!iso) return 'SIN_FECHA';
  const dia = iso.slice(0, 10);
  const hoy = fechaHoy();
  if (dia < hoy) return 'ATRASADA';
  if (dia === hoy) return 'HOY';
  const manana = new Date(); manana.setDate(manana.getDate() + 1);
  if (dia === manana.toISOString().slice(0, 10)) return 'MANANA';
  const semana = new Date(); semana.setDate(semana.getDate() + 7);
  if (dia <= semana.toISOString().slice(0, 10)) return 'SEMANA';
  return 'DESPUES';
};
const BUCKET_META: Record<Bucket, { label: string; cls: string }> = {
  ATRASADA:  { label: '⚠️ Atrasadas',   cls: 'text-red-700' },
  HOY:       { label: '📌 HOY',         cls: 'text-blue-700' },
  MANANA:    { label: 'Mañana',         cls: 'text-yellow-700' },
  SEMANA:    { label: 'Esta semana',    cls: 'text-gray-700' },
  DESPUES:   { label: 'Más adelante',   cls: 'text-gray-500' },
  SIN_FECHA: { label: 'Sin fecha',      cls: 'text-gray-500' },
};
const BUCKET_ORDER: Bucket[] = ['ATRASADA', 'HOY', 'MANANA', 'SEMANA', 'DESPUES', 'SIN_FECHA'];

const TABS = [
  { key: 'todas',       label: 'Todas' },
  { key: 'agendado',    label: 'Agendado' },
  { key: 'en_proceso',  label: 'En proceso' },
  { key: 'finalizado',  label: 'Finalizado' },
  { key: 'entregado',   label: 'Entregado' },
];

export function MisTrabajos() {
  const [ordenes, setOrdenes]   = useState<ApiOrdenServicio[]>([]);
  const [catalogo, setCatalogo] = useState<ApiServicioCatalogo[]>([]);
  const [clientes, setClientes] = useState<ApiCliente[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filtro, setFiltro]     = useState('agendado');

  // Modal registrar
  const [openReg, setOpenReg] = useState(false);
  const [tipo, setTipo]       = useState<'preventivo' | 'correctivo'>('preventivo');
  const [origen, setOrigen]   = useState<'tienda' | 'externo'>('externo');
  const [equipo, setEquipo]   = useState<'laptop' | 'escritorio'>('laptop');
  const [clienteId, setClienteId]     = useState('');
  const [equipoDesc, setEquipoDesc]   = useState('');
  const [elegib, setElegib]           = useState<ApiElegibilidad[]>([]);
  const [garantiaSel, setGarantiaSel] = useState('');
  const [serviciosSel, setServiciosSel] = useState<Set<number>>(new Set());
  const [fechaRetiro, setFechaRetiro] = useState('');
  const [saving, setSaving] = useState(false);
  const [regError, setRegError] = useState('');
  useEscapeKey(openReg, () => setOpenReg(false));

  // Modal detalle
  const [detalle, setDetalle] = useState<ApiOrdenServicio | null>(null);
  useEscapeKey(!!detalle, () => setDetalle(null));

  // Modal reagendar (cambiar fecha de una orden ya agendada)
  const [agendarTarget, setAgendarTarget] = useState<ApiOrdenServicio | null>(null);
  const [fechaEntrega, setFechaEntrega]   = useState('');
  const [agendando, setAgendando]         = useState(false);
  const [agendarError, setAgendarError]   = useState('');
  useEscapeKey(!!agendarTarget, () => setAgendarTarget(null));

  // Toast
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const mostrarToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4000);
  };

  const cargar = () => {
    setLoading(true);
    Promise.all([servicioTecnicoAPI.ordenes(), servicioTecnicoAPI.catalogo(), clientesAPI.getAll()])
      .then(([o, c, cl]) => { setOrdenes(o); setCatalogo(c); setClientes(cl); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  useEffect(() => {
    if (origen === 'tienda' && clienteId) {
      servicioTecnicoAPI.elegibilidad(Number(clienteId)).then(setElegib).catch(() => setElegib([]));
    } else {
      setElegib([]); setGarantiaSel('');
    }
  }, [origen, clienteId]);

  const preventivos = catalogo.filter(s => s.tipo === 'preventivo');
  const correctivos = catalogo.filter(s => s.tipo === 'correctivo');
  const precioPrev  = Number(preventivos.find(s => s.equipo === equipo)?.precio ?? 0);
  const garantiaElegida = elegib.find(g => String(g.garantia_id) === garantiaSel);
  const esGratis = tipo === 'preventivo' && origen === 'tienda' && equipo === 'laptop'
    && !!garantiaElegida && garantiaElegida.usos_disponibles > 0;

  const costoPreview = tipo === 'preventivo'
    ? (esGratis ? 0 : precioPrev)
    : correctivos.filter(s => serviciosSel.has(s.id)).reduce((sum, s) => sum + Number(s.precio), 0);

  const abrirReg = () => {
    setTipo('preventivo'); setOrigen('externo'); setEquipo('laptop');
    setClienteId(''); setEquipoDesc(''); setGarantiaSel(''); setServiciosSel(new Set());
    setFechaRetiro(fechaSugerida(3));
    setRegError(''); setOpenReg(true);
  };

  const guardar = async () => {
    if (tipo === 'correctivo' && serviciosSel.size === 0) { setRegError('Elige al menos un servicio correctivo.'); return; }
    if (origen === 'tienda' && !clienteId) { setRegError('Elige el cliente.'); return; }
    if (origen === 'externo' && !equipoDesc.trim()) { setRegError('Describe el equipo (marca/modelo).'); return; }
    if (!fechaRetiro) { setRegError('Define la fecha de retiro.'); return; }
    if (fechaRetiro < fechaHoy()) { setRegError('La fecha de retiro no puede ser en el pasado.'); return; }
    setSaving(true); setRegError('');
    const data: any = { tipo, origen, equipo, fecha_entrega_prevista: fechaRetiro };
    if (origen === 'tienda' && clienteId) data.cliente = Number(clienteId);
    if (origen === 'externo') data.equipo_descripcion = equipoDesc.trim();
    if (tipo === 'preventivo' && esGratis && garantiaSel) data.garantia = Number(garantiaSel);
    if (tipo === 'correctivo') data.servicios = Array.from(serviciosSel);
    try {
      const nueva = await servicioTecnicoAPI.crear(data);
      setOpenReg(false);
      cargar();
      mostrarToast(true,
        `Orden #${nueva.id} agendada para ${formatFechaCorta(nueva.fecha_entrega_prevista)}. Correo enviado al cliente.`);
    } catch (e) {
      setRegError(e instanceof Error ? e.message : 'No se pudo registrar.');
    } finally {
      setSaving(false);
    }
  };

  const cambiarEstado = async (o: ApiOrdenServicio, estado: string) => {
    try {
      const upd = await servicioTecnicoAPI.cambiarEstado(o.id, { estado });
      setDetalle(null);
      cargar();
      const msgs: Record<string, string> = {
        en_proceso: `Orden #${upd.id} iniciada.`,
        finalizado: `Orden #${upd.id} finalizada. Correo enviado al cliente.`,
        cancelado:  `Orden #${upd.id} cancelada.`,
      };
      mostrarToast(true, msgs[estado] || `Orden #${upd.id} actualizada.`);
    } catch (e) {
      mostrarToast(false, e instanceof Error ? e.message : 'No se pudo actualizar.');
    }
  };

  const abrirAgendar = (o: ApiOrdenServicio) => {
    setAgendarTarget(o);
    setFechaEntrega(o.fecha_entrega_prevista || fechaSugerida(3));
    setAgendarError('');
  };

  const guardarAgendar = async () => {
    if (!agendarTarget) return;
    if (!fechaEntrega) { setAgendarError('Elige una fecha de retiro.'); return; }
    if (fechaEntrega < fechaHoy()) { setAgendarError('La fecha no puede ser en el pasado.'); return; }
    setAgendando(true);
    setAgendarError('');
    try {
      const upd = await servicioTecnicoAPI.agendar(agendarTarget.id, fechaEntrega);
      setAgendarTarget(null);
      setDetalle(null);
      cargar();
      mostrarToast(true,
        `Orden reagendada. Retiro: ${formatFechaCorta(upd.fecha_entrega_prevista)}. Correo enviado al cliente.`);
    } catch (e) {
      setAgendarError(e instanceof Error ? e.message : 'No se pudo agendar.');
    } finally {
      setAgendando(false);
    }
  };

  const marcarEntregado = async (o: ApiOrdenServicio) => {
    if (!confirm(`¿Marcar la orden #${o.id} como entregada al cliente?`)) return;
    try {
      const upd = await servicioTecnicoAPI.entregar(o.id);
      setDetalle(null);
      cargar();
      mostrarToast(true, `Orden #${upd.id} marcada como entregada.`);
    } catch (e) {
      mostrarToast(false, e instanceof Error ? e.message : 'No se pudo entregar.');
    }
  };

  const toggleTarea = async (o: ApiOrdenServicio, tareaId: number, realizado: boolean) => {
    try {
      const upd = await servicioTecnicoAPI.checklist(o.id, [{ id: tareaId, realizado }]);
      setDetalle(upd);
    } catch { /* noop */ }
  };

  // Contadores por estado (para los badges de los tabs)
  const contadores: Record<string, number> = { todas: ordenes.length };
  for (const o of ordenes) contadores[o.estado] = (contadores[o.estado] || 0) + 1;

  const ordenesFiltradas = filtro === 'todas' ? ordenes : ordenes.filter(o => o.estado === filtro);
  // Agrupar por bucket sólo cuando el filtro es Agendado o En proceso
  const debeAgrupar = filtro === 'agendado' || filtro === 'en_proceso';
  const grupos: Partial<Record<Bucket, ApiOrdenServicio[]>> = {};
  if (debeAgrupar) {
    const sorted = [...ordenesFiltradas].sort((a, b) => {
      const fa = a.fecha_entrega_prevista || '9999-12-31';
      const fb = b.fecha_entrega_prevista || '9999-12-31';
      return fa.localeCompare(fb);
    });
    for (const o of sorted) {
      const b = bucketDeFecha(o.fecha_entrega_prevista);
      (grupos[b] ??= []).push(o);
    }
  }

  const renderCard = (o: ApiOrdenServicio) => (
    <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <button onClick={() => setDetalle(o)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADOS[o.estado]?.cls ?? ''}`}>
              {ESTADOS[o.estado]?.label ?? o.estado}
            </span>
            <p className="font-semibold text-gray-900">
              #{o.id} · {o.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo'} · {o.equipo}
            </p>
            {o.fecha_entrega_prevista && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Retiro: {formatFechaCorta(o.fecha_entrega_prevista)}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 truncate">
            {o.cliente_nombre} · {o.origen === 'tienda' ? 'Cliente de tienda' : 'Externo'}
            {' · '}{o.es_beneficio ? 'GRATIS' : `Bs ${Number(o.costo_total).toFixed(2)}`}
          </p>
        </button>
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {(o.estado === 'agendado' || o.estado === 'solicitado') && (
            <button onClick={() => setDetalle(o)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              title="Abrir orden para revisar el checklist antes de iniciar">
              <Wrench className="w-4 h-4" /> Iniciar
            </button>
          )}
          {o.estado === 'en_proceso' && (
            <button onClick={() => cambiarEstado(o, 'finalizado')}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
              <CheckCircle className="w-4 h-4" /> Finalizar
            </button>
          )}
          {o.estado === 'finalizado' && (
            <button onClick={() => marcarEntregado(o)}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">
              <PackageCheck className="w-4 h-4" /> Marcar entregado
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-blue-600" /> Mis Trabajos
          </h1>
          <p className="text-gray-600">Órdenes de servicio técnico</p>
        </div>
        <button onClick={abrirReg} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          <Plus className="w-4 h-4" /> Registrar servicio
        </button>
      </div>

      {/* Tabs con contador */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => {
          const activo = filtro === t.key;
          const n = contadores[t.key] ?? 0;
          return (
            <button key={t.key} onClick={() => setFiltro(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition
                          ${activo
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <span>{t.label}</span>
              <span className={`inline-flex items-center justify-center min-w-[22px] px-1.5 rounded-full text-xs font-bold
                                ${activo ? 'bg-white text-blue-600' : 'bg-gray-100 text-gray-700'}`}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lista / agrupación */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Cargando...</div>
      ) : ordenesFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No hay órdenes con este filtro.
        </div>
      ) : debeAgrupar ? (
        <div className="space-y-6">
          {BUCKET_ORDER.filter(b => grupos[b]?.length).map(b => (
            <div key={b}>
              <h2 className={`text-sm font-bold uppercase tracking-wider mb-2 ${BUCKET_META[b].cls}`}>
                {BUCKET_META[b].label}
              </h2>
              <div className="space-y-2">
                {grupos[b]!.map(renderCard)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {ordenesFiltradas.map(renderCard)}
        </div>
      )}

      {/* ── MODAL REGISTRAR ── */}
      {openReg && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpenReg(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Registrar servicio</h2>
              <button onClick={() => setOpenReg(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de servicio</label>
                <div className="flex gap-2">
                  {(['preventivo', 'correctivo'] as const).map(t => (
                    <button key={t} onClick={() => setTipo(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border ${tipo === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
                      {t === 'preventivo' ? 'Preventivo' : 'Correctivo'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">¿Quién trae el equipo?</label>
                <div className="flex gap-2">
                  {(['tienda', 'externo'] as const).map(o => (
                    <button key={o} onClick={() => setOrigen(o)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border ${origen === o ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
                      {o === 'tienda' ? 'Cliente de tienda' : 'Externo'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipo</label>
                <div className="flex gap-2">
                  {(['laptop', 'escritorio'] as const).map(e => (
                    <button key={e} onClick={() => setEquipo(e)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border ${equipo === e ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
                      {e === 'laptop' ? 'Laptop' : 'Escritorio'}
                    </button>
                  ))}
                </div>
              </div>

              {origen === 'tienda' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                  <select value={clienteId} onChange={e => setClienteId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">— Elige un cliente —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
                  </select>
                  {tipo === 'preventivo' && equipo === 'laptop' && clienteId && (
                    <div className="mt-2 space-y-1">
                      {elegib.length === 0 && <p className="text-xs text-gray-400">Sin garantías vigentes → se cobra.</p>}
                      {elegib.map(g => (
                        <label key={g.garantia_id} className="flex items-center gap-2 text-sm">
                          <input type="radio" name="gar" checked={garantiaSel === String(g.garantia_id)}
                            onChange={() => setGarantiaSel(String(g.garantia_id))} />
                          {g.producto} · {g.usos_disponibles > 0
                            ? <span className="text-green-600 font-medium">{g.usos_disponibles} uso(s) gratis</span>
                            : <span className="text-gray-400">sin usos gratis</span>}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {origen === 'externo' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del equipo</label>
                  <input value={equipoDesc} onChange={e => setEquipoDesc(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Marca / modelo / serie" />
                </div>
              )}

              {tipo === 'correctivo' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Servicios</label>
                  <div className="space-y-1">
                    {correctivos.map(s => (
                      <label key={s.id} className="flex items-center justify-between gap-2 text-sm border border-gray-200 rounded-lg px-3 py-2">
                        <span className="flex items-center gap-2">
                          <input type="checkbox" checked={serviciosSel.has(s.id)}
                            onChange={e => {
                              const next = new Set(serviciosSel);
                              e.target.checked ? next.add(s.id) : next.delete(s.id);
                              setServiciosSel(next);
                            }} />
                          {s.nombre}
                        </span>
                        <span className="text-gray-500">Bs {Number(s.precio).toFixed(0)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Fecha de retiro (obligatoria — la orden nace agendada) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" /> Fecha de retiro
                </label>
                <input type="date" value={fechaRetiro} min={fechaHoy()}
                  onChange={e => setFechaRetiro(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <p className="text-xs text-gray-500 mt-1">
                  Al confirmar, la orden queda agendada y se envía correo al cliente con esta fecha.
                </p>
              </div>

              <div className={`rounded-lg p-3 text-sm ${esGratis ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
                Costo: <strong>{esGratis ? 'GRATIS (beneficio)' : `Bs ${costoPreview.toFixed(2)}`}</strong>
              </div>

              {regError && <div className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">{regError}</div>}
            </div>
            <div className="flex gap-2 p-4 border-t border-gray-200">
              <button onClick={() => setOpenReg(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancelar</button>
              <button disabled={saving} onClick={guardar} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Registrar y agendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DETALLE ── */}
      {detalle && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDetalle(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Orden #{detalle.id} · {ESTADOS[detalle.estado]?.label}
              </h2>
              <button onClick={() => setDetalle(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <p><span className="text-gray-500">Tipo:</span> {detalle.tipo}</p>
                <p><span className="text-gray-500">Equipo:</span> {detalle.equipo}</p>
                <p><span className="text-gray-500">Cliente:</span> {detalle.cliente_nombre}</p>
                <p><span className="text-gray-500">Origen:</span> {detalle.origen}</p>
                <p><span className="text-gray-500">Costo:</span> {detalle.es_beneficio ? 'GRATIS' : `Bs ${Number(detalle.costo_total).toFixed(2)}`}</p>
                {detalle.fecha_entrega_prevista && (
                  <p className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-blue-900">
                      Retiro previsto: <strong>{formatFechaCorta(detalle.fecha_entrega_prevista)}</strong>
                    </span>
                  </p>
                )}
                {detalle.fecha_entrega_real && (
                  <p className="col-span-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
                    <PackageCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-900">
                      Entregado al cliente: <strong>{new Date(detalle.fecha_entrega_real).toLocaleString('es-BO')}</strong>
                    </span>
                  </p>
                )}
              </div>

              {detalle.detalles.length > 0 && (
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Servicios</p>
                  {detalle.detalles.map(d => (
                    <div key={d.id} className="flex justify-between text-gray-600"><span>{d.servicio_nombre}</span><span>Bs {Number(d.precio).toFixed(2)}</span></div>
                  ))}
                </div>
              )}

              {detalle.tareas.length > 0 && (
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Checklist</p>
                  {detalle.tareas.map(t => (
                    <label key={t.id} className="flex items-center gap-2 py-0.5">
                      <input type="checkbox" checked={t.realizado} onChange={e => toggleTarea(detalle, t.id, e.target.checked)} />
                      <span className={t.realizado ? 'text-gray-700' : 'text-gray-500'}>{t.tarea}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {detalle.estado !== 'entregado' && detalle.estado !== 'cancelado' && (
              <div className="flex gap-2 p-4 border-t border-gray-200 flex-wrap">
                {(detalle.estado === 'solicitado' || detalle.estado === 'agendado') && (
                  <button onClick={() => abrirAgendar(detalle)} className="px-3 py-2 border border-yellow-400 text-yellow-700 rounded-lg hover:bg-yellow-50 text-sm font-medium flex items-center gap-1">
                    <Calendar className="w-4 h-4" /> Reagendar
                  </button>
                )}
                {(detalle.estado === 'solicitado' || detalle.estado === 'agendado') && (
                  <button onClick={() => cambiarEstado(detalle, 'en_proceso')} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Iniciar</button>
                )}
                {detalle.estado === 'en_proceso' && (
                  <button onClick={() => cambiarEstado(detalle, 'finalizado')} className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center justify-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Finalizar
                  </button>
                )}
                {detalle.estado === 'finalizado' && (
                  <button onClick={() => marcarEntregado(detalle)} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium flex items-center justify-center gap-1">
                    <PackageCheck className="w-4 h-4" /> Marcar entregado
                  </button>
                )}
                {detalle.estado !== 'finalizado' && (
                  <button onClick={() => cambiarEstado(detalle, 'cancelado')} className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium">Cancelar</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL REAGENDAR ── */}
      {agendarTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAgendarTarget(null)}>
          <div className="bg-white rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-yellow-500" />
                Reagendar orden #{agendarTarget.id}
              </h2>
              <button onClick={() => setAgendarTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Cambiar la fecha de retiro. Se le enviará un correo al cliente con la nueva fecha.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de retiro</label>
                <input type="date" value={fechaEntrega} min={fechaHoy()}
                  onChange={e => setFechaEntrega(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              {agendarError && (
                <div className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
                  {agendarError}
                </div>
              )}
            </div>
            <div className="flex gap-2 p-4 border-t border-gray-200">
              <button onClick={() => setAgendarTarget(null)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                Cancelar
              </button>
              <button disabled={agendando} onClick={guardarAgendar}
                className="flex-1 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium disabled:opacity-50">
                {agendando ? 'Enviando...' : 'Reagendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] max-w-sm rounded-lg shadow-lg border px-4 py-3 text-sm font-medium
                        ${toast.ok
                          ? 'bg-green-50 border-green-200 text-green-800'
                          : 'bg-red-50 border-red-200 text-red-700'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
