/**
 * Creditos.tsx — Venta a crédito (CU28) + Cartera de créditos (CU29)
 *
 * Página única (sin tabs):
 *   • Header con botón compacto "+ Nuevo" que abre modal wizard con
 *     divulgación progresiva vertical (cliente → producto → plan → tipo
 *     empleo → checklist → antigüedad → observaciones → confirmar).
 *   • Cartera con resumen compacto (1 sola card), filtros con contadores,
 *     proyección de cobros expandible y lista de planes con barra de
 *     progreso visual.
 *
 * Reglas (calculadas en el backend):
 *   Precio unitario Bs 1–5.000 → 6 cuotas (+20%) · 5.001–10.000 → 9 (+25%)
 *   · 10.001–15.000 → 12 (+30%). Inicial 20% del financiado. Mora 10%.
 *   Máximo 3 créditos activos por cliente. ≥1 cuota vencida → bloqueo total.
 */
import { useState, useEffect } from 'react';
import {
  CreditCard, Wallet, TrendingUp, AlertTriangle, CheckCircle, CheckCircle2,
  ChevronDown, ChevronUp, Search, X, Banknote, Plus,
  FileText, Store as StoreIcon,
} from 'lucide-react';
import {
  creditoAPI, clientesAPI, productosAPI, categoriasAPI,
  ApiCartera, ApiPlanCredito, ApiSimulacionCredito,
  ApiCliente, ApiProduct, ApiCategoria, ApiBloqueoCredito, CreditoAtomicoPayload,
} from '../services/api';
import { useEscapeKey } from '../hooks/useEscapeKey';

const bs = (x: number | string) => `Bs ${Number(x).toFixed(2)}`;
const ANTIGUEDAD_MINIMA_MESES = 12;

const estadoPlan = (e: string) => {
  if (e === 'pagado') return { txt: 'Pagado', cls: 'bg-green-100 text-green-700' };
  if (e === 'moroso') return { txt: 'Moroso', cls: 'bg-red-100 text-red-700' };
  return { txt: 'Vigente', cls: 'bg-blue-100 text-blue-700' };
};

const estadoCuota = (e: string) => {
  if (e === 'pagada')  return { txt: 'Pagada',   cls: 'bg-green-100 text-green-700' };
  if (e === 'vencida') return { txt: 'Vencida',  cls: 'bg-red-100 text-red-700' };
  return { txt: 'Pendiente', cls: 'bg-gray-100 text-gray-600' };
};

const checklistVacio = () => ({
  ci_solicitante: false, ci_conyuge: false, factura_servicios: false,
  boletas_pago: false, extracto_gestora: false,
  facturas_ultimo_ano: false, estados_financieros: false, nit: false,
  croquis_domicilio: false, croquis_negocio: false, respaldos_patrimoniales: false,
});
type ChecklistBool = ReturnType<typeof checklistVacio>;

export function Creditos() {
  const [openWizard, setOpenWizard] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const mostrarToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4500);
  };

  // Cuando el wizard crea un crédito, refrescamos la cartera
  const onWizardExito = (msg: string) => {
    mostrarToast(true, msg);
    setOpenWizard(false);
    setRefreshTrigger(x => x + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-600" /> Créditos
          </h1>
          <p className="text-gray-600">Venta a crédito y cartera de cobranza</p>
        </div>
        <button onClick={() => setOpenWizard(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      <Cartera onToast={mostrarToast} refreshTrigger={refreshTrigger} />

      {openWizard && (
        <WizardWalkIn onCancel={() => setOpenWizard(false)} onExito={onWizardExito} />
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

// ── Cartera (CU29) ────────────────────────────────────────────────────────────
function Cartera({ onToast, refreshTrigger }: {
  onToast: (ok: boolean, text: string) => void;
  refreshTrigger: number;
}) {
  const [data, setData]       = useState<ApiCartera | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [cobroTarget, setCobroTarget] = useState<{ planId: number; cuotaId: number; numero: number; monto: number; mora: number } | null>(null);
  const [cobrando, setCobrando]   = useState(false);
  const [filtro, setFiltro]   = useState<'todos' | 'vigente' | 'moroso' | 'pagado'>('todos');
  const [proyeccionExpandida, setProyeccionExpandida] = useState(false);
  useEscapeKey(!!cobroTarget, () => setCobroTarget(null));

  const cargar = () => {
    setLoading(true);
    creditoAPI.cartera()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };
  useEffect(cargar, [refreshTrigger]);

  const confirmarCobro = async () => {
    if (!cobroTarget) return;
    setCobrando(true);
    try {
      const plan = await creditoAPI.pagarCuota(cobroTarget.cuotaId);
      const cuota = plan.cuotas?.find(c => c.id === cobroTarget.cuotaId);
      const fcr = cuota?.numero_factura;
      setCobroTarget(null);
      cargar();
      onToast(true, `Cuota ${cobroTarget.numero} cobrada${fcr ? ` — factura ${fcr}` : ''}. Correo enviado al cliente.`);
    } catch (e) {
      onToast(false, e instanceof Error ? e.message : 'No se pudo registrar el pago.');
    } finally {
      setCobrando(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando cartera...</div>;
  if (!data)   return <div className="p-8 text-center text-gray-400">No se pudo cargar la cartera.</div>;

  const r = data.resumen;
  const planes = data.planes.filter(p => filtro === 'todos' ? true : p.estado === filtro);

  // Contadores por estado para los tabs de filtro
  const contadores = {
    todos:   data.planes.length,
    vigente: r.planes_vigentes,
    moroso:  r.planes_morosos,
    pagado:  r.planes_pagados,
  };

  const TABS: { key: typeof filtro; label: string }[] = [
    { key: 'todos',   label: 'Todos' },
    { key: 'vigente', label: 'Vigentes' },
    { key: 'moroso',  label: 'Morosos' },
    { key: 'pagado',  label: 'Pagados' },
  ];

  return (
    <div className="space-y-4">
      {/* ── Resumen compacto — 1 sola card con 4 métricas + separación con conteos ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-100">
          <MetricaCell icon={CreditCard}   cls="text-indigo-600" label="Total financiado" val={bs(r.total_financiado)} />
          <MetricaCell icon={CheckCircle}  cls="text-green-600"  label="Total cobrado"    val={bs(r.total_cobrado)} />
          <MetricaCell icon={Wallet}       cls="text-blue-600"   label="Por cobrar"       val={bs(r.por_cobrar)} />
          <MetricaCell icon={AlertTriangle} cls={Number(r.en_mora) > 0 ? 'text-red-600' : 'text-gray-400'} label="En mora" val={bs(r.en_mora)} />
        </div>
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 flex items-center justify-center gap-6 text-sm">
          <span className="flex items-center gap-1.5 text-blue-700">
            <span className="font-bold">{r.planes_vigentes}</span>
            <span className="text-gray-600 text-xs">Vigente{r.planes_vigentes === 1 ? '' : 's'}</span>
          </span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1.5 text-red-700">
            <span className="font-bold">{r.planes_morosos}</span>
            <span className="text-gray-600 text-xs">Moroso{r.planes_morosos === 1 ? '' : 's'}</span>
          </span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1.5 text-green-700">
            <span className="font-bold">{r.planes_pagados}</span>
            <span className="text-gray-600 text-xs">Pagado{r.planes_pagados === 1 ? '' : 's'}</span>
          </span>
        </div>
      </div>

      {r.clientes_bloqueados > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {r.clientes_bloqueados} cliente(s) bloqueado(s) para nuevos créditos por tener cuotas vencidas.
        </div>
      )}

      {/* ── Proyección de cobros — 6 meses por default, expandible ── */}
      {data.proyeccion.length > 0 && (() => {
        const total       = data.proyeccion.length;
        const mostrados   = proyeccionExpandida ? total : Math.min(6, total);
        const hayMasCortos = total > 6;
        return (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" /> Proyección de cobros (cuotas pendientes)
              </h3>
              {hayMasCortos && (
                <button onClick={() => setProyeccionExpandida(!proyeccionExpandida)}
                  className="text-xs text-indigo-600 hover:underline font-medium">
                  {proyeccionExpandida
                    ? `▲ Mostrar solo próximos 6`
                    : `▼ Ver todos (${total} meses)`}
                </button>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {data.proyeccion.slice(0, mostrados).map(p => (
                <div key={p.mes} className="min-w-[110px] bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-center">
                  <div className="text-xs text-indigo-500">{p.mes}</div>
                  <div className="font-bold text-indigo-700 text-sm">{bs(p.monto)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Filtros con contadores (patrón MisTrabajos) ── */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => {
          const activo = filtro === t.key;
          const n = contadores[t.key] ?? 0;
          return (
            <button key={t.key} onClick={() => setFiltro(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition
                          ${activo
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <span>{t.label}</span>
              <span className={`inline-flex items-center justify-center min-w-[22px] px-1.5 rounded-full text-xs font-bold
                                ${activo ? 'bg-white text-indigo-600' : 'bg-gray-100 text-gray-700'}`}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Lista de planes con barra de progreso visual ── */}
      <div className="space-y-3">
        {planes.length === 0 ? (
          <div className="p-8 text-center text-gray-400 bg-white border border-gray-200 rounded-xl">
            No hay planes de crédito {filtro !== 'todos' ? `(${filtro})` : ''}.
          </div>
        ) : planes.map(p => {
          const est = estadoPlan(p.estado);
          const abierto = expandido === p.id;
          const progresoPct = p.n_cuotas > 0 ? Math.round((p.cuotas_pagadas / p.n_cuotas) * 100) : 0;
          return (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setExpandido(abierto ? null : p.id)}
                className="w-full p-4 hover:bg-gray-50 text-left">
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900 truncate">{p.producto_nombre}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {p.cliente_nombre} · #{p.id}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${est.cls}`}>{est.txt}</span>
                    {abierto ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>
                {/* Chips con iconos */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 mb-3">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    {p.numero_factura || `Venta #${p.venta}`}
                  </span>
                  {p.origen && (
                    <span className="inline-flex items-center gap-1">
                      <StoreIcon className="w-3.5 h-3.5 text-gray-400" />
                      {p.origen === 'walk_in' ? 'Walk-in' : 'Desde Sales'}
                    </span>
                  )}
                </div>
                {/* Saldo + cuotas + barra de progreso */}
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <div className="text-xs text-gray-500">Saldo pendiente</div>
                    <div className="font-bold text-gray-900">{bs(p.saldo)}</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Progreso</span>
                      <span>{p.cuotas_pagadas}/{p.n_cuotas}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full transition-all ${p.estado === 'pagado' ? 'bg-green-500' : p.estado === 'moroso' ? 'bg-red-500' : 'bg-indigo-500'}`}
                        style={{ width: `${progresoPct}%` }} />
                    </div>
                  </div>
                </div>
              </button>

              {abierto && (
                <div className="border-t border-gray-100 p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <Dato label="Financiado" val={bs(p.precio_financiado)} />
                    <Dato label={`Recargo`} val={`+${Number(p.recargo_pct)}%`} />
                    <Dato label="Inicial (pagada)" val={bs(p.inicial)} />
                    <Dato label="Cuota" val={bs(p.monto_cuota)} />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">#</th>
                          <th className="text-left px-3 py-2 font-medium">Vence</th>
                          <th className="text-right px-3 py-2 font-medium">Monto</th>
                          <th className="text-right px-3 py-2 font-medium">Mora</th>
                          <th className="text-center px-3 py-2 font-medium">Estado</th>
                          <th className="text-right px-3 py-2 font-medium">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.cuotas.map(c => {
                          const ec = estadoCuota(c.estado);
                          return (
                            <tr key={c.id} className="border-b border-gray-100">
                              <td className="px-3 py-2">{c.numero}</td>
                              <td className="px-3 py-2 text-gray-600">{c.fecha_vencimiento}</td>
                              <td className="px-3 py-2 text-right">{bs(c.monto)}</td>
                              <td className="px-3 py-2 text-right text-red-600">{Number(c.mora) > 0 ? bs(c.mora) : '—'}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ec.cls}`}>{ec.txt}</span>
                              </td>
                              <td className="px-3 py-2 text-right">
                                {c.estado === 'pagada' ? (
                                  <span className="text-xs text-gray-400">
                                    {c.numero_factura ? c.numero_factura :
                                      c.fecha_pago ? new Date(c.fecha_pago).toLocaleDateString() : '✓'}
                                  </span>
                                ) : (
                                  <button onClick={() => setCobroTarget({
                                    planId: p.id, cuotaId: c.id, numero: c.numero,
                                    monto: Number(c.monto), mora: Number(c.mora),
                                  })}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium">
                                    <Banknote className="w-3.5 h-3.5" /> Cobrar
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de confirmación de cobro presencial (efectivo) */}
      {cobroTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCobroTarget(null)}>
          <div className="bg-white rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-green-600" /> Cobrar cuota {cobroTarget.numero}
              </h2>
              <button onClick={() => setCobroTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-xs text-green-700 font-semibold tracking-wider">A COBRAR EN EFECTIVO</div>
                <div className="text-2xl font-bold text-green-900 mt-1">
                  {bs(cobroTarget.monto + cobroTarget.mora)}
                </div>
                <div className="text-xs text-green-700 mt-1">
                  Monto: {bs(cobroTarget.monto)}
                  {cobroTarget.mora > 0 && <span className="text-red-700"> · Mora: {bs(cobroTarget.mora)}</span>}
                </div>
              </div>
              <p className="text-gray-600">
                Se registrará el pago, se emitirá una factura <strong>FCR-{new Date().getFullYear()}-…</strong>
                y se le enviará al cliente por correo.
              </p>
            </div>
            <div className="flex gap-2 p-4 border-t border-gray-200">
              <button onClick={() => setCobroTarget(null)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                Cancelar
              </button>
              <button disabled={cobrando} onClick={confirmarCobro}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" /> {cobrando ? 'Cobrando…' : 'Confirmar cobro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricaCell({ icon: Icon, cls, label, val }: {
  icon: typeof CreditCard; cls: string; label: string; val: string;
}) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <Icon className={`w-4 h-4 ${cls}`} />
      </div>
      <div className={`text-xl font-bold ${cls}`}>{val}</div>
    </div>
  );
}

function Dato({ label, val }: { label: string; val: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900">{val}</div>
    </div>
  );
}

// ── WizardWalkIn — modal con divulgación progresiva vertical (CU28) ────────
function WizardWalkIn({ onCancel, onExito }: {
  onCancel: () => void;
  onExito: (msg: string) => void;
}) {
  const [clientes, setClientes] = useState<ApiCliente[]>([]);
  const [productos, setProductos] = useState<ApiProduct[]>([]);
  const [categorias, setCategorias] = useState<ApiCategoria[]>([]);
  const [loading, setLoading] = useState(true);

  const [buscaCli, setBuscaCli]   = useState('');
  const [buscaProd, setBuscaProd] = useState('');
  const [categoriaId, setCategoriaId] = useState<number | ''>('');
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [productoId, setProductoId] = useState<number | null>(null);
  const [cantidad, setCantidad]   = useState(1);

  const [bloqueo, setBloqueo]         = useState<ApiBloqueoCredito | null>(null);
  const [sim, setSim]                 = useState<ApiSimulacionCredito | null>(null);
  const [tipoEmpleo, setTipoEmpleo]   = useState<'dependiente' | 'independiente' | null>(null);
  const [cumpleAntiguedad, setCumpleAntiguedad] = useState(false);
  const [obs, setObs]                 = useState('');
  const [checklist, setChecklist]     = useState<ChecklistBool>(checklistVacio());
  const [aprobando, setAprobando]     = useState(false);
  const [error, setError]             = useState('');
  useEscapeKey(true, onCancel);

  useEffect(() => {
    Promise.all([clientesAPI.getAll(), productosAPI.getAll(), categoriasAPI.getAll()])
      .then(([cs, ps, cats]) => { setClientes(cs); setProductos(ps); setCategorias(cats); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Al cambiar cliente → consultar bloqueo
  useEffect(() => {
    if (!clienteId) { setBloqueo(null); return; }
    creditoAPI.bloqueo(clienteId).then(setBloqueo).catch(() => setBloqueo(null));
  }, [clienteId]);

  const producto = productos.find(p => p.id === productoId);
  const precio   = producto ? parseFloat(String(producto.price)) : 0;
  const elegibleBasico = !!clienteId && !!producto && precio >= 1 && precio <= 15000
    && (producto.stock ?? 0) >= cantidad;

  useEffect(() => {
    if (!elegibleBasico) { setSim(null); return; }
    creditoAPI.simular(precio, cantidad).then(setSim).catch(() => setSim(null));
  }, [elegibleBasico, precio, cantidad]);

  const cliente = clientes.find(c => c.id === clienteId);

  const filClientes = clientes
    .filter(c => {
      if (!buscaCli.trim()) return true;
      const t = buscaCli.toLowerCase();
      return (`${c.nombre} ${c.apellido}`).toLowerCase().includes(t)
          || (c.nit_ci || '').toLowerCase().includes(t)
          || (c.correo || '').toLowerCase().includes(t);
    })
    .slice(0, 30);

  const filProductos = productos
    .filter(p => {
      const pu = parseFloat(String(p.price));
      if (pu < 1 || pu > 15000) return false;
      if (categoriaId !== '' && p.categoria !== categoriaId) return false;
      if (!buscaProd.trim()) return true;
      const t = buscaProd.toLowerCase();
      return p.name.toLowerCase().includes(t)
          || (p.marca || '').toLowerCase().includes(t)
          || (p.modelo || '').toLowerCase().includes(t);
    })
    .slice(0, 30);

  const bloqueado = bloqueo?.motivo === 'mora' || bloqueo?.motivo === 'limite';
  const puedeConfirmar = !!clienteId && !!producto && sim?.elegible
    && !!tipoEmpleo && cumpleAntiguedad && !bloqueado;

  const confirmar = async () => {
    if (!clienteId || !productoId || !tipoEmpleo) return;
    setError('');
    setAprobando(true);
    try {
      const payload: CreditoAtomicoPayload = {
        cliente:          clienteId,
        producto:         productoId,
        cantidad,
        tipo_empleo:      tipoEmpleo,
        antiguedad_meses: ANTIGUEDAD_MINIMA_MESES,
        observaciones:    obs.trim() || undefined,
        checklist,
      };
      const plan = await creditoAPI.crearWalkIn(payload);
      let msg = `Crédito aprobado — factura ${plan.numero_factura}. Correo enviado al cliente.`;
      if (plan.advertencia) msg += ` ⚠️ ${plan.advertencia}`;
      onExito(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aprobar el crédito.');
    } finally {
      setAprobando(false);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-8 text-center text-gray-500">Cargando…</div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-indigo-600" /> Nuevo crédito
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">

          {/* ① Cliente */}
          <WizardStep num={1} label="Cliente" done={!!clienteId}>
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={buscaCli} onChange={e => setBuscaCli(e.target.value)}
                placeholder="Buscar por nombre, CI o correo…"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {filClientes.map(c => (
                <button key={c.id} onClick={() => setClienteId(c.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition
                              ${clienteId === c.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <div className="font-medium text-gray-900">{c.nombre} {c.apellido}</div>
                  <div className="text-xs text-gray-500">
                    {c.nit_ci || 'sin CI'} · {c.correo || 'sin correo'}
                  </div>
                </button>
              ))}
              {filClientes.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-4">Sin resultados.</div>
              )}
            </div>

            {/* Estado del cliente elegido */}
            {cliente && bloqueo && (
              <div className="mt-2 text-xs">
                {bloqueo.motivo === 'mora' && (
                  <div className="bg-red-100 border border-red-200 text-red-800 rounded px-2 py-1 flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Bloqueado: {bloqueo.cuotas_vencidas} cuota(s) vencida(s).</span>
                  </div>
                )}
                {bloqueo.motivo === 'limite' && (
                  <div className="bg-red-100 border border-red-200 text-red-800 rounded px-2 py-1 flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Bloqueado: ya tiene {bloqueo.activos} créditos activos (máx {bloqueo.limite}).</span>
                  </div>
                )}
                {bloqueo.motivo === 'advertencia' && (
                  <div className="bg-orange-100 border border-orange-200 text-orange-800 rounded px-2 py-1 flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Tiene {bloqueo.activos} activos. Este será el 3ro (tope); el próximo será rechazado.</span>
                  </div>
                )}
                {!bloqueo.motivo && (
                  <div className="text-gray-600">Créditos activos: {bloqueo.activos}/{bloqueo.limite}.</div>
                )}
              </div>
            )}
          </WizardStep>

          {/* ② Producto */}
          {clienteId && !bloqueado && (
            <WizardStep num={2} label="Producto" done={!!productoId}>
              <select value={categoriaId}
                onChange={e => { setCategoriaId(e.target.value ? parseInt(e.target.value) : ''); setProductoId(null); }}
                className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Todas las categorías</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <div className="relative mb-2">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={buscaProd} onChange={e => setBuscaProd(e.target.value)}
                  placeholder="Buscar producto (solo Bs 1–15.000)…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {filProductos.map(p => (
                  <button key={p.id} onClick={() => setProductoId(p.id)}
                    disabled={(p.stock ?? 0) < 1}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm disabled:opacity-40 transition
                                ${productoId === p.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900 truncate">{p.name}</span>
                      <span className="text-xs text-gray-600 shrink-0">{bs(p.price)}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {p.marca || 'sin marca'} · Stock: {p.stock ?? 0}
                    </div>
                  </button>
                ))}
                {filProductos.length === 0 && (
                  <div className="text-xs text-gray-400 text-center py-4">Sin resultados.</div>
                )}
              </div>
              {producto && (
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-sm text-gray-600">Cantidad</label>
                  <input type="number" min={1} max={producto.stock ?? 1} value={cantidad}
                    onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                  <span className="text-xs text-gray-500">de {producto.stock ?? 0} en stock</span>
                </div>
              )}
            </WizardStep>
          )}

          {/* ③ Plan calculado (auto, informativo) */}
          {elegibleBasico && sim?.elegible && (
            <WizardStep num={3} label="Plan calculado" done>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-700">
                  <span>Base ({cantidad} u.)</span>
                  <span>{bs(sim.precio_base!)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Recargo (+{Number(sim.recargo_pct)}%)</span>
                  <span>{bs(Number(sim.precio_financiado) - Number(sim.precio_base))}</span>
                </div>
                <div className="flex justify-between font-semibold text-indigo-900 pt-1 border-t border-indigo-200">
                  <span>Total financiado</span>
                  <span>{bs(sim.precio_financiado!)}</span>
                </div>
                <div className="flex justify-between text-green-700 font-semibold">
                  <span>Inicial (efectivo hoy)</span>
                  <span>{bs(sim.inicial!)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Saldo en cuotas</span>
                  <span>{sim.n_cuotas} × {bs(sim.monto_cuota!)}</span>
                </div>
              </div>
            </WizardStep>
          )}
          {elegibleBasico && sim && !sim.elegible && (
            <div className="ml-11 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 text-sm text-amber-800">
              {sim.motivo || 'Este producto no califica a crédito.'}
            </div>
          )}

          {/* ④ Tipo de empleo */}
          {elegibleBasico && sim?.elegible && (
            <WizardStep num={4} label="Tipo de empleo" done={!!tipoEmpleo}>
              <div className="grid grid-cols-2 gap-3">
                {(['dependiente', 'independiente'] as const).map(t => (
                  <button key={t} onClick={() => setTipoEmpleo(t)}
                    className={`py-3 px-3 rounded-lg text-sm font-medium border-2 transition
                      ${tipoEmpleo === t ? 'bg-indigo-50 border-indigo-500 text-indigo-900' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                    {t === 'dependiente' ? 'Dependiente' : 'Independiente'}
                  </button>
                ))}
              </div>
            </WizardStep>
          )}

          {/* ⑤ Documentos entregados (adaptado según tipo empleo) */}
          {tipoEmpleo && (
            <WizardStep num={5} label="Documentos entregados" done>
              <p className="text-xs text-gray-500 mb-2">Marcá los que el cliente presentó físicamente.</p>
              <div className="space-y-1.5">
                {[
                  ['ci_solicitante',   'CI del solicitante'],
                  ['ci_conyuge',       'CI del cónyuge (si aplica)'],
                  ['factura_servicios','Factura de servicios (domicilio)'],
                  ...(tipoEmpleo === 'dependiente' ? [
                    ['boletas_pago',     '3 últimas boletas de pago'],
                    ['extracto_gestora', 'Extracto AFP / Gestora Pública'],
                  ] : []),
                  ...(tipoEmpleo === 'independiente' ? [
                    ['facturas_ultimo_ano',     'Facturas del último año'],
                    ['estados_financieros',     'Estados financieros'],
                    ['nit',                     'NIT'],
                    ['croquis_domicilio',       'Croquis de domicilio'],
                    ['croquis_negocio',         'Croquis de negocio'],
                    ['respaldos_patrimoniales', 'Respaldos patrimoniales (autos/inmuebles)'],
                  ] : []),
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox"
                      checked={checklist[key as keyof ChecklistBool]}
                      onChange={e => setChecklist({ ...checklist, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>
            </WizardStep>
          )}

          {/* ⑥ Requisito de antigüedad */}
          {tipoEmpleo && (
            <WizardStep num={6} label="Requisito de reglamento" done={cumpleAntiguedad}>
              <label className={`flex items-start gap-2 cursor-pointer border-2 rounded-lg px-3 py-2 transition
                                  ${cumpleAntiguedad ? 'bg-emerald-50 border-emerald-500' : 'bg-gray-50 border-gray-200'}`}>
                <input type="checkbox" checked={cumpleAntiguedad}
                  onChange={e => setCumpleAntiguedad(e.target.checked)}
                  className="mt-0.5" />
                <span className="text-sm">
                  <span className="font-medium text-gray-800">
                    Antigüedad laboral mínima ({ANTIGUEDAD_MINIMA_MESES} meses)
                  </span>
                  <span className="block text-xs text-gray-500">
                    El vendedor confirma que el cliente cumple con este requisito.
                  </span>
                </span>
              </label>
            </WizardStep>
          )}

          {/* Observaciones opcionales — aparecen cuando ya está todo casi listo */}
          {tipoEmpleo && cumpleAntiguedad && (
            <div className="ml-11">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea rows={2} value={obs} onChange={e => setObs(e.target.value)}
                placeholder="Notas del vendedor sobre el crédito"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <button onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
            Cancelar
          </button>
          <button disabled={aprobando || !puedeConfirmar} onClick={confirmar}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {aprobando ? 'Aprobando…' : <><CheckCircle className="w-4 h-4" /> Iniciar crédito</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * WizardStep — bloque de paso del formulario con divulgación progresiva.
 * Número circular a la izquierda (verde si done=true), título arriba y el
 * contenido del paso adentro. Se apila verticalmente en el modal.
 * Mismo componente que usa MisTrabajos para consistencia visual.
 */
function WizardStep({ num, label, done, children }: {
  num: number;
  label: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                        ${done
                          ? 'bg-emerald-500 text-white'
                          : 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500'}`}>
        {done ? <CheckCircle2 className="w-5 h-5" /> : num}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
        {children}
      </div>
    </div>
  );
}

