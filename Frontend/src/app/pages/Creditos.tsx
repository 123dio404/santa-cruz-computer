/**
 * Creditos.tsx — Venta a crédito (CU28) + Cartera de créditos (CU29)
 *
 * Dos pestañas:
 *   • Cartera: resumen + proyección + lista de planes con cobro presencial
 *     de cuotas en efectivo. Al cobrar se emite factura FCR-... y se envía
 *     por correo al cliente.
 *   • Nuevo crédito presencial (walk-in): el cliente viene físicamente sin
 *     una venta previa. Se elige cliente + producto, se muestra la simulación,
 *     se llena el checklist (tipo empleo + documentos), y al confirmar se crea
 *     TODO en una sola transacción: venta + inicial en efectivo + plan +
 *     checklist + N cuotas + numero_factura, y se le envía el correo al cliente.
 *
 * Reglas (calculadas en el backend):
 *   Precio unitario Bs 1–5.000 → 6 cuotas (+20%) · 5.001–10.000 → 9 (+25%)
 *   · 10.001–15.000 → 12 (+30%). Inicial 20% del financiado. Mora 10%.
 *   Máximo 3 créditos activos por cliente. ≥1 cuota vencida → bloqueo total.
 */
import { useState, useEffect } from 'react';
import {
  CreditCard, Wallet, TrendingUp, AlertTriangle, CheckCircle, Clock,
  ChevronDown, ChevronUp, Search, X, Banknote, UserPlus, Package,
} from 'lucide-react';
import {
  creditoAPI, clientesAPI, productosAPI,
  ApiCartera, ApiPlanCredito, ApiSimulacionCredito,
  ApiCliente, ApiProduct, ApiBloqueoCredito, CreditoAtomicoPayload,
} from '../services/api';
import { useEscapeKey } from '../hooks/useEscapeKey';

type Tab = 'cartera' | 'walkin';

const bs = (x: number | string) => `Bs ${Number(x).toFixed(2)}`;

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
  const [tab, setTab] = useState<Tab>('cartera');
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const mostrarToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-indigo-600" /> Créditos
        </h1>
        <p className="text-gray-600">Venta a crédito y cartera de cobranza</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button onClick={() => setTab('cartera')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'cartera' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Cartera
        </button>
        <button onClick={() => setTab('walkin')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'walkin' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          + Nuevo crédito presencial
        </button>
      </div>

      {tab === 'cartera' ? <Cartera onToast={mostrarToast} /> : <WalkIn onToast={mostrarToast} />}

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

// ── Pestaña: Cartera (CU29) ───────────────────────────────────────────────────
function Cartera({ onToast }: { onToast: (ok: boolean, text: string) => void }) {
  const [data, setData]       = useState<ApiCartera | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [cobroTarget, setCobroTarget] = useState<{ planId: number; cuotaId: number; numero: number; monto: number; mora: number } | null>(null);
  const [cobrando, setCobrando]   = useState(false);
  const [filtro, setFiltro]   = useState<'todos' | 'vigente' | 'moroso' | 'pagado'>('todos');
  useEscapeKey(!!cobroTarget, () => setCobroTarget(null));

  const cargar = () => {
    setLoading(true);
    creditoAPI.cartera()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };
  useEffect(cargar, []);

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

  const cards = [
    { label: 'Total financiado', val: bs(r.total_financiado), icon: CreditCard, cls: 'text-indigo-600' },
    { label: 'Total cobrado',    val: bs(r.total_cobrado),    icon: CheckCircle, cls: 'text-green-600' },
    { label: 'Por cobrar',       val: bs(r.por_cobrar),       icon: Wallet,      cls: 'text-blue-600' },
    { label: 'En mora',          val: bs(r.en_mora),          icon: AlertTriangle, cls: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{c.label}</span>
              <c.icon className={`w-4 h-4 ${c.cls}`} />
            </div>
            <div className={`text-xl font-bold mt-1 ${c.cls}`}>{c.val}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{r.planes_vigentes}</div>
          <div className="text-xs text-gray-500">Vigentes</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-700">{r.planes_morosos}</div>
          <div className="text-xs text-gray-500">Morosos</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{r.planes_pagados}</div>
          <div className="text-xs text-gray-500">Pagados</div>
        </div>
      </div>

      {r.clientes_bloqueados > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {r.clientes_bloqueados} cliente(s) bloqueado(s) para nuevos créditos por tener cuotas vencidas.
        </div>
      )}

      {/* Proyección de cobros */}
      {data.proyeccion.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-indigo-600" /> Proyección de cobros (cuotas pendientes)
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {data.proyeccion.map(p => (
              <div key={p.mes} className="min-w-[110px] bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-center">
                <div className="text-xs text-indigo-500">{p.mes}</div>
                <div className="font-bold text-indigo-700 text-sm">{bs(p.monto)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtro + lista de planes */}
      <div className="flex gap-2 flex-wrap">
        {(['todos', 'vigente', 'moroso', 'pagado'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${filtro === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f === 'todos' ? 'Todos' : f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {planes.length === 0 ? (
          <div className="p-8 text-center text-gray-400 bg-white border border-gray-200 rounded-xl">
            No hay planes de crédito {filtro !== 'todos' ? `(${filtro})` : ''}.
          </div>
        ) : planes.map(p => {
          const est = estadoPlan(p.estado);
          const abierto = expandido === p.id;
          return (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setExpandido(abierto ? null : p.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{p.producto_nombre}</div>
                  <div className="text-xs text-gray-500">
                    #{p.id} · {p.cliente_nombre} · {p.numero_factura || `Venta #${p.venta}`}
                    {p.origen && (
                      <span className="ml-2 text-indigo-600">
                        · {p.origen === 'walk_in' ? 'Walk-in' : 'Desde Sales'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-gray-500">Saldo</div>
                    <div className="font-bold text-gray-900">{bs(p.saldo)}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${est.cls}`}>{est.txt}</span>
                  <span className="text-xs text-gray-500">{p.cuotas_pagadas}/{p.n_cuotas}</span>
                  {abierto ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
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

function Dato({ label, val }: { label: string; val: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900">{val}</div>
    </div>
  );
}

// ── Pestaña: Nuevo crédito presencial (walk-in) — CU28 ──────────────────────
function WalkIn({ onToast }: { onToast: (ok: boolean, text: string) => void }) {
  const [clientes, setClientes] = useState<ApiCliente[]>([]);
  const [productos, setProductos] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [buscaCli, setBuscaCli]   = useState('');
  const [buscaProd, setBuscaProd] = useState('');
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [productoId, setProductoId] = useState<number | null>(null);
  const [cantidad, setCantidad]   = useState(1);

  const [bloqueo, setBloqueo]         = useState<ApiBloqueoCredito | null>(null);
  const [sim, setSim]                 = useState<ApiSimulacionCredito | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [tipoEmpleo, setTipoEmpleo]   = useState<'dependiente' | 'independiente'>('dependiente');
  const [antiguedad, setAntiguedad]   = useState(12);
  const [obs, setObs]                 = useState('');
  const [checklist, setChecklist]     = useState<ChecklistBool>(checklistVacio());
  const [aprobando, setAprobando]     = useState(false);
  const [error, setError]             = useState('');
  useEscapeKey(showChecklist, () => setShowChecklist(false));

  useEffect(() => {
    Promise.all([clientesAPI.getAll(), productosAPI.getAll()])
      .then(([cs, ps]) => { setClientes(cs); setProductos(ps); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Al cambiar cliente → consultar bloqueo
  useEffect(() => {
    if (!clienteId) { setBloqueo(null); return; }
    creditoAPI.bloqueo(clienteId).then(setBloqueo).catch(() => setBloqueo(null));
  }, [clienteId]);

  // Al cambiar producto/cantidad → simular
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
      if (!buscaProd.trim()) return true;
      const t = buscaProd.toLowerCase();
      return p.name.toLowerCase().includes(t)
          || (p.marca || '').toLowerCase().includes(t)
          || (p.modelo || '').toLowerCase().includes(t);
    })
    .slice(0, 30);

  const abrirChecklist = () => {
    if (!elegibleBasico || !sim?.elegible) return;
    setTipoEmpleo('dependiente');
    setAntiguedad(12);
    setObs('');
    setChecklist(checklistVacio());
    setError('');
    setShowChecklist(true);
  };

  const confirmar = async () => {
    if (!clienteId || !productoId) return;
    setError('');
    setAprobando(true);
    try {
      const payload: CreditoAtomicoPayload = {
        cliente:          clienteId,
        producto:         productoId,
        cantidad,
        tipo_empleo:      tipoEmpleo,
        antiguedad_meses: antiguedad,
        observaciones:    obs.trim() || undefined,
        checklist,
      };
      const plan = await creditoAPI.crearWalkIn(payload);
      setShowChecklist(false);
      let msg = `Crédito aprobado — factura ${plan.numero_factura}. Correo enviado al cliente.`;
      if (plan.advertencia) msg += ` ⚠️ ${plan.advertencia}`;
      onToast(true, msg);
      // Reset del formulario y refresco de stock
      setClienteId(null); setProductoId(null); setCantidad(1);
      setBuscaCli(''); setBuscaProd(''); setSim(null); setBloqueo(null);
      productosAPI.getAll().then(setProductos).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aprobar el crédito.');
    } finally {
      setAprobando(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando…</div>;

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 text-sm text-indigo-800">
        Crédito <strong>walk-in</strong>: el cliente vino a la tienda. Elegí cliente + producto,
        armamos el plan y cobramos la inicial en efectivo — todo en un solo paso.
        Al confirmar se le envía la factura al cliente por correo.
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Columna cliente */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-600" /> 1. Cliente
          </h3>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={buscaCli} onChange={e => setBuscaCli(e.target.value)}
              placeholder="Buscar por nombre, CI o correo…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
            {filClientes.map(c => (
              <button key={c.id} onClick={() => setClienteId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${clienteId === c.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
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

          {cliente && (
            <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm">
              <div className="font-semibold text-indigo-900">{cliente.nombre} {cliente.apellido}</div>
              <div className="text-xs text-indigo-800">
                {cliente.nit_ci || 'sin CI'} · {cliente.correo || 'sin correo'}
              </div>
              {bloqueo && (
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
            </div>
          )}
        </div>

        {/* Columna producto */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" /> 2. Producto
          </h3>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={buscaProd} onChange={e => setBuscaProd(e.target.value)}
              placeholder="Buscar producto (solo Bs 1–15.000)…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
            {filProductos.map(p => (
              <button key={p.id} onClick={() => setProductoId(p.id)}
                disabled={(p.stock ?? 0) < 1}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm disabled:opacity-40 ${productoId === p.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <div className="flex items-center justify-between">
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
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Cantidad</label>
                <input type="number" min={1} max={producto.stock ?? 1} value={cantidad}
                  onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                <span className="text-xs text-gray-500">de {producto.stock ?? 0} en stock</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simulación + CTA */}
      {elegibleBasico && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" /> 3. Plan sugerido
          </h3>
          {!sim ? (
            <div className="text-center text-gray-400 py-4">Calculando…</div>
          ) : !sim.elegible ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 text-sm text-amber-800">
              {sim.motivo || 'Este producto no califica a crédito.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <Dato label="Financiado" val={bs(sim.precio_financiado!)} />
              <Dato label="Recargo"    val={`+${Number(sim.recargo_pct)}%`} />
              <Dato label="Inicial"    val={bs(sim.inicial!)} />
              <Dato label="Cuotas"     val={String(sim.n_cuotas)} />
              <Dato label="Cuota/mes"  val={bs(sim.monto_cuota!)} />
              <Dato label="Saldo"      val={bs(sim.saldo!)} />
            </div>
          )}

          <button onClick={abrirChecklist}
            disabled={!sim?.elegible || bloqueo?.motivo === 'mora' || bloqueo?.motivo === 'limite'}
            className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <Wallet className="w-5 h-5" /> Aprobar crédito
          </button>
        </div>
      )}

      {/* Modal checklist */}
      {showChecklist && producto && sim?.elegible && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowChecklist(false)}>
          <div className="bg-white rounded-xl w-full max-w-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-indigo-600" /> Checklist y aprobación
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {cliente?.nombre} {cliente?.apellido} · {producto.name} × {cantidad}
                </p>
              </div>
              <button onClick={() => setShowChecklist(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-1">
                <div className="text-xs text-indigo-700 font-semibold tracking-wider">RESUMEN FINANCIERO</div>
                <div className="flex justify-between"><span>Total financiado</span><span className="font-semibold">{bs(sim.precio_financiado!)}</span></div>
                <div className="flex justify-between text-green-700"><span>Inicial (efectivo hoy)</span><span className="font-semibold">{bs(sim.inicial!)}</span></div>
                <div className="flex justify-between"><span>Saldo</span><span>{sim.n_cuotas} × {bs(sim.monto_cuota!)}</span></div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Tipo de empleo</label>
                <div className="flex gap-2">
                  {(['dependiente', 'independiente'] as const).map(t => (
                    <button key={t} onClick={() => setTipoEmpleo(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border ${tipoEmpleo === t ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600'}`}>
                      {t === 'dependiente' ? 'Dependiente' : 'Independiente'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Antigüedad laboral (meses)</label>
                <input type="number" min={0} value={antiguedad}
                  onChange={e => setAntiguedad(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-700 tracking-wider">DOCUMENTOS ENTREGADOS</p>
                <p className="text-xs text-gray-500">Marcar los que el cliente presentó físicamente.</p>

                {[
                  ['ci_solicitante',   'CI del solicitante'],
                  ['ci_conyuge',       'CI del cónyuge (si aplica)'],
                  ['factura_servicios','Factura de servicios (domicilio)'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox"
                      checked={checklist[key as keyof ChecklistBool]}
                      onChange={e => setChecklist({ ...checklist, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}

                {tipoEmpleo === 'dependiente' && [
                  ['boletas_pago',     '3 últimas boletas de pago'],
                  ['extracto_gestora', 'Extracto AFP / Gestora Pública'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox"
                      checked={checklist[key as keyof ChecklistBool]}
                      onChange={e => setChecklist({ ...checklist, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}

                {tipoEmpleo === 'independiente' && [
                  ['facturas_ultimo_ano',     'Facturas del último año'],
                  ['estados_financieros',     'Estados financieros'],
                  ['nit',                     'NIT'],
                  ['croquis_domicilio',       'Croquis de domicilio'],
                  ['croquis_negocio',         'Croquis de negocio'],
                  ['respaldos_patrimoniales', 'Respaldos patrimoniales (autos/inmuebles)'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox"
                      checked={checklist[key as keyof ChecklistBool]}
                      onChange={e => setChecklist({ ...checklist, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Observaciones (opcional)</label>
                <textarea rows={2} value={obs} onChange={e => setObs(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              {bloqueo?.motivo === 'advertencia' && (
                <div className="bg-orange-50 border border-orange-200 text-orange-800 text-xs rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Este cliente llegará al tope de 3 créditos activos. El próximo será rechazado.</span>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-2 p-4 border-t border-gray-200">
              <button onClick={() => setShowChecklist(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                Cancelar
              </button>
              <button disabled={aprobando} onClick={confirmar}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {aprobando ? 'Aprobando…' : <><CheckCircle className="w-4 h-4" /> Cobrar inicial y crear crédito</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
