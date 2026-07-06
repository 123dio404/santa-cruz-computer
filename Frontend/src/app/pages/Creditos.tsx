/**
 * Creditos.tsx — Venta a crédito (CU28) + Cartera de créditos (CU29)
 *
 * Dos pestañas:
 *   • Registrar crédito: el vendedor elige una venta, un producto elegible,
 *     ve la simulación del plan (cuotas, inicial, recargo) y lo crea.
 *   • Cartera: resumen de todos los créditos + proyección de cobros + lista
 *     de planes con sus cuotas y el botón para cobrar cada cuota.
 *
 * Reglas (calculadas en el backend):
 *   Precio unitario Bs 1–5.000 → 6 cuotas (+20%) · 5.001–10.000 → 9 (+25%)
 *   · 10.001–15.000 → 12 (+30%). Inicial 20% del financiado. Mora 10% + bloqueo.
 */
import { useState, useEffect } from 'react';
import {
  CreditCard, Wallet, TrendingUp, AlertTriangle, CheckCircle, Clock,
  ChevronDown, ChevronUp, Search, X, Banknote,
} from 'lucide-react';
import {
  creditoAPI, ventasAPI, ApiCartera, ApiPlanCredito, ApiSimulacionCredito,
  ApiVenta, ApiDetalleVenta,
} from '../services/api';
import { useEscapeKey } from '../hooks/useEscapeKey';

type Tab = 'registrar' | 'cartera';

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

export function Creditos() {
  const [tab, setTab] = useState<Tab>('cartera');

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
        <button onClick={() => setTab('registrar')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'registrar' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Registrar crédito
        </button>
      </div>

      {tab === 'cartera' ? <Cartera /> : <Registrar />}
    </div>
  );
}

// ── Pestaña: Cartera (CU29) ───────────────────────────────────────────────────
function Cartera() {
  const [data, setData]       = useState<ApiCartera | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [cobrando, setCobrando]   = useState<number | null>(null);
  const [filtro, setFiltro]   = useState<'todos' | 'vigente' | 'moroso' | 'pagado'>('todos');

  const cargar = () => {
    setLoading(true);
    creditoAPI.cartera()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  const cobrar = async (cuotaId: number, numero: number) => {
    if (!confirm(`¿Registrar el pago de la cuota ${numero}?`)) return;
    setCobrando(cuotaId);
    try {
      await creditoAPI.pagarCuota(cuotaId);
      cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo registrar el pago.');
    } finally {
      setCobrando(null);
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
                    #{p.id} · {p.cliente_nombre} · Venta #{p.venta}
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
                                    {c.fecha_pago ? new Date(c.fecha_pago).toLocaleDateString() : '✓'}
                                  </span>
                                ) : (
                                  <button onClick={() => cobrar(c.id, c.numero)} disabled={cobrando === c.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium disabled:opacity-50">
                                    <Banknote className="w-3.5 h-3.5" /> {cobrando === c.id ? '...' : 'Cobrar'}
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

// ── Pestaña: Registrar crédito (CU28) ─────────────────────────────────────────
function Registrar() {
  const [ventas, setVentas]   = useState<ApiVenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca]     = useState('');
  const [ventaSel, setVentaSel] = useState<ApiVenta | null>(null);
  const [bloqueo, setBloqueo] = useState<{ bloqueado: boolean; cuotas_vencidas: number } | null>(null);

  // Modal de simulación
  const [detSel, setDetSel]   = useState<ApiDetalleVenta | null>(null);
  const [sim, setSim]         = useState<ApiSimulacionCredito | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [creando, setCreando] = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  useEscapeKey(!!detSel, () => cerrarModal());

  const cargar = () => {
    setLoading(true);
    ventasAPI.getAll()
      .then(vs => setVentas(vs.filter(v => (v.detalles?.length ?? 0) > 0)))
      .catch(() => setVentas([]))
      .finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  const seleccionarVenta = async (v: ApiVenta) => {
    setVentaSel(v);
    setBloqueo(null);
    if (v.cliente) {
      try { setBloqueo(await creditoAPI.bloqueo(v.cliente)); } catch { /* noop */ }
    }
  };

  const abrirSimulacion = async (d: ApiDetalleVenta) => {
    setDetSel(d);
    setSim(null);
    setMsg(null);
    setSimLoading(true);
    try {
      setSim(await creditoAPI.simular(Number(d.precio_unitario), d.cantidad));
    } catch {
      setSim({ elegible: false, motivo: 'No se pudo calcular el plan.' });
    } finally {
      setSimLoading(false);
    }
  };

  const cerrarModal = () => { setDetSel(null); setSim(null); setMsg(null); };

  const crear = async () => {
    if (!detSel) return;
    setCreando(true); setMsg(null);
    try {
      await creditoAPI.crear(detSel.id);
      setMsg({ ok: true, text: '✅ Plan de crédito creado. Revísalo en la pestaña Cartera.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo crear el plan.' });
    } finally {
      setCreando(false);
    }
  };

  const ventasFiltradas = ventas.filter(v => {
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    return String(v.id).includes(t) || (v.cliente_name || '').toLowerCase().includes(t);
  }).slice(0, 40);

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 text-sm text-indigo-800">
        Elige una venta y el producto a financiar. El plan es <strong>por producto</strong> según su
        precio unitario (Bs 1–15.000). La inicial (20%) se paga al inicio; el resto en cuotas mensuales.
      </div>

      {/* Buscador de ventas */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar venta por # o cliente..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">Cargando ventas...</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Lista de ventas */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {ventasFiltradas.map(v => (
              <button key={v.id} onClick={() => seleccionarVenta(v)}
                className={`w-full text-left p-3 rounded-lg border ${ventaSel?.id === v.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Venta #{v.id}</span>
                  <span className="text-sm text-gray-600">{bs(v.total)}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {v.cliente_name || 'Consumidor Final'} · {new Date(v.fecha).toLocaleDateString()} · {v.detalles?.length ?? 0} ítem(s)
                </div>
              </button>
            ))}
            {ventasFiltradas.length === 0 && (
              <div className="p-6 text-center text-gray-400 text-sm">No hay ventas que coincidan.</div>
            )}
          </div>

          {/* Detalle de la venta seleccionada */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            {!ventaSel ? (
              <div className="text-center text-gray-400 text-sm py-10">Selecciona una venta para ver sus productos.</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">Venta #{ventaSel.id}</h3>
                  <span className="text-xs text-gray-500">{ventaSel.cliente_name || 'Consumidor Final'}</span>
                </div>

                {bloqueo?.bloqueado && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Cliente bloqueado: {bloqueo.cuotas_vencidas} cuota(s) vencida(s). No se le puede dar más crédito.
                  </div>
                )}

                <div className="space-y-2">
                  {(ventaSel.detalles ?? []).map(d => {
                    const pu = Number(d.precio_unitario);
                    const elegible = pu >= 1 && pu <= 15000;
                    return (
                      <div key={d.id} className="flex items-center justify-between gap-2 p-2 border border-gray-100 rounded-lg">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">{d.producto_name || `Producto #${d.producto}`}</div>
                          <div className="text-xs text-gray-500">{d.cantidad} × {bs(pu)}</div>
                        </div>
                        <button
                          onClick={() => abrirSimulacion(d)}
                          disabled={!elegible || bloqueo?.bloqueado}
                          title={!elegible ? 'El precio unitario debe estar entre Bs 1 y 15.000' : ''}
                          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400">
                          A crédito
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de simulación */}
      {detSel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={cerrarModal}>
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Plan de crédito</h2>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-sm text-gray-600">
                {detSel.producto_name} — {detSel.cantidad} × {bs(detSel.precio_unitario)}
              </div>

              {simLoading ? (
                <div className="py-6 text-center text-gray-400">Calculando...</div>
              ) : sim && !sim.elegible ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 text-sm text-amber-800">
                  {sim.motivo || 'Este producto no califica a crédito.'}
                </div>
              ) : sim ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Dato label="Financiado" val={bs(sim.precio_financiado!)} />
                    <Dato label="Recargo" val={`+${Number(sim.recargo_pct)}%`} />
                    <Dato label="Inicial (paga hoy)" val={bs(sim.inicial!)} />
                    <Dato label="N.º de cuotas" val={String(sim.n_cuotas)} />
                    <Dato label="Cuota mensual" val={bs(sim.monto_cuota!)} />
                    <Dato label="Saldo a financiar" val={bs(sim.saldo!)} />
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-800 flex items-start gap-2">
                    <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>Se generarán {sim.n_cuotas} cuotas mensuales de {bs(sim.monto_cuota!)}
                      (la última ajusta el redondeo). La 1.ª vence en 1 mes.</span>
                  </div>
                </>
              ) : null}

              {msg && (
                <div className={`text-sm rounded-lg px-3 py-2 border ${msg.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {msg.text}
                </div>
              )}
            </div>
            <div className="flex gap-2 p-4 border-t border-gray-200">
              <button onClick={cerrarModal}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                {msg?.ok ? 'Cerrar' : 'Cancelar'}
              </button>
              {!msg?.ok && (
                <button disabled={creando || simLoading || !sim?.elegible} onClick={crear}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50">
                  {creando ? 'Creando...' : 'Crear plan'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
