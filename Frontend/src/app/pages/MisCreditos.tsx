/**
 * MisCreditos.tsx — Vista del CLIENTE con sus créditos (CU28/CU29)
 *
 * Muestra:
 *   • Cards de resumen: planes activos, saldo, cuotas vencidas, próxima cuota.
 *   • Lista de sus créditos colapsables con cronograma completo.
 *   • Botón "Pagar con tarjeta" en cada cuota pendiente/vencida → Stripe Checkout.
 *   • Botón "¿Ya pagaste? Verificar" cuando quedó una sesión Stripe pendiente
 *     (el cliente cerró la pestaña antes de volver al return URL).
 *   • Al volver de Stripe con ?cuota_confirm=SESSION_ID se llama automáticamente
 *     a confirmar-cuota y se muestra el resultado.
 *   • "Ver comprobante" en la inicial y en cada cuota pagada → modal imprimible.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  CreditCard, Wallet, CheckCircle, AlertTriangle, ChevronDown, ChevronUp,
  Printer, ExternalLink, Clock, Loader2, X,
} from 'lucide-react';
import {
  creditoAPI, ApiPlanCredito, ApiCuota, ApiMisCreditosResumen,
} from '../services/api';
import { useEscapeKey } from '../hooks/useEscapeKey';

const bs = (x: number | string) => `Bs ${Number(x).toFixed(2)}`;
const fmtFecha = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

type ComprobanteTarget =
  | { tipo: 'inicial'; plan: ApiPlanCredito }
  | { tipo: 'cuota';   plan: ApiPlanCredito; cuota: ApiCuota };

export function MisCreditos() {
  const [params, setParams] = useSearchParams();
  const [data, setData]     = useState<{ resumen: ApiMisCreditosResumen; planes: ApiPlanCredito[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [pagando, setPagando]     = useState<number | null>(null);   // cuotaId
  const [verificando, setVerificando] = useState<number | null>(null); // cuotaId
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmandoReturn, setConfirmandoReturn] = useState(false);
  const [comprobante, setComprobante] = useState<ComprobanteTarget | null>(null);
  useEscapeKey(!!comprobante, () => setComprobante(null));

  // Ref al bloque imprimible del comprobante
  const printableRef = useRef<HTMLDivElement>(null);

  const mostrarToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 5000);
  };

  const cargar = () => {
    setLoading(true);
    creditoAPI.misCreditos()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  // Return URL de Stripe: /mis-creditos?cuota_confirm=cs_xxx
  const cuotaConfirm = params.get('cuota_confirm');
  useEffect(() => {
    if (!cuotaConfirm) return;
    setConfirmandoReturn(true);
    creditoAPI.confirmarCuota(cuotaConfirm)
      .then(r => {
        if (r.estado_pago === 'confirmada') mostrarToast(true, 'Pago confirmado. Cuota registrada — te enviamos la factura por correo.');
        else if (r.estado_pago === 'ya_pagada') mostrarToast(true, 'Esta cuota ya estaba registrada. Todo en orden.');
        else mostrarToast(false, 'El pago aún no fue confirmado por Stripe. Vas a poder verificar desde la cuota.');
      })
      .catch(e => mostrarToast(false, e instanceof Error ? e.message : 'No se pudo confirmar el pago.'))
      .finally(() => {
        setConfirmandoReturn(false);
        cargar();
        // Limpiar el query param para que un F5 no reintente
        const next = new URLSearchParams(params);
        next.delete('cuota_confirm');
        setParams(next, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuotaConfirm]);

  const pagarStripe = async (cuota: ApiCuota) => {
    setPagando(cuota.id);
    try {
      const r = await creditoAPI.checkoutCuota(cuota.id);
      window.location.href = r.url;   // Redirige al hosted checkout de Stripe
    } catch (e) {
      mostrarToast(false, e instanceof Error ? e.message : 'No se pudo iniciar el pago.');
      setPagando(null);
    }
  };

  const verificarPendiente = async (cuota: ApiCuota) => {
    setVerificando(cuota.id);
    try {
      const r = await creditoAPI.verificarCuotaPendiente(cuota.id);
      if (r.estado_pago === 'confirmada') mostrarToast(true, 'Confirmado. Cuota registrada — factura enviada por correo.');
      else if (r.estado_pago === 'ya_pagada') mostrarToast(true, 'Esta cuota ya estaba registrada.');
      else mostrarToast(false, 'Todavía no vemos el pago confirmado en Stripe. Volvé a intentar en un rato.');
      cargar();
    } catch (e) {
      mostrarToast(false, e instanceof Error ? e.message : 'No se pudo verificar el pago.');
    } finally {
      setVerificando(null);
    }
  };

  const imprimir = () => {
    if (!printableRef.current) return;
    // Abrir una ventana con el HTML del comprobante y llamar print
    const ventana = window.open('', '_blank', 'width=760,height=900');
    if (!ventana) { mostrarToast(false, 'El navegador bloqueó la ventana. Habilitá popups para imprimir.'); return; }
    ventana.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Comprobante</title>
      <style>body{font-family:Arial,sans-serif;margin:20px;color:#111827}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{padding:6px;border-bottom:1px solid #e5e7eb}
      .box{border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:12px 0}
      .brand{background:#1e40af;color:#fff;padding:14px;border-radius:8px 8px 0 0}
      </style></head><body>${printableRef.current.innerHTML}</body></html>`);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => { ventana.print(); }, 200);
  };

  const resumenCards = useMemo(() => {
    if (!data) return [];
    const r = data.resumen;
    return [
      { label: 'Planes activos', val: String(r.planes_activos), icon: CreditCard, cls: 'text-indigo-600' },
      { label: 'Saldo pendiente', val: bs(r.saldo_pendiente), icon: Wallet, cls: 'text-blue-600' },
      { label: 'Cuotas pendientes', val: String(r.cuotas_pendientes), icon: Clock, cls: 'text-gray-700' },
      { label: 'Cuotas vencidas',   val: String(r.cuotas_vencidas),   icon: AlertTriangle, cls: r.cuotas_vencidas > 0 ? 'text-red-600' : 'text-gray-400' },
    ];
  }, [data]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
    </div>
  );

  if (!data || data.planes.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-600" /> Mis Créditos
          </h1>
          <p className="text-gray-600">Tus créditos y cuotas al día</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Todavía no tenés créditos</h3>
          <p className="text-gray-600">Cuando armes un crédito en la tienda, va a aparecer acá con su cronograma de cuotas.</p>
        </div>
      </div>
    );
  }

  const r = data.resumen;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-indigo-600" /> Mis Créditos
        </h1>
        <p className="text-gray-600">Tus créditos, cuotas y comprobantes</p>
      </div>

      {confirmandoReturn && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Confirmando tu pago con Stripe…
        </div>
      )}

      {/* Cards resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {resumenCards.map(c => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{c.label}</span>
              <c.icon className={`w-4 h-4 ${c.cls}`} />
            </div>
            <div className={`text-xl font-bold mt-1 ${c.cls}`}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Alerta próxima cuota */}
      {r.proxima_cuota && (
        <div className={`rounded-xl px-4 py-3 text-sm flex items-start gap-3 ${r.proxima_cuota.estado === 'vencida'
          ? 'bg-red-50 border border-red-200 text-red-800'
          : 'bg-indigo-50 border border-indigo-200 text-indigo-900'}`}>
          {r.proxima_cuota.estado === 'vencida'
            ? <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            : <Clock className="w-5 h-5 shrink-0 mt-0.5" />}
          <div>
            <div className="font-semibold">
              {r.proxima_cuota.estado === 'vencida' ? 'Tenés una cuota vencida' : 'Próxima cuota'}
            </div>
            <div className="text-sm">
              Cuota #{r.proxima_cuota.numero} — vence el {fmtFecha(r.proxima_cuota.fecha_vencimiento)} · {bs(Number(r.proxima_cuota.monto) + Number(r.proxima_cuota.mora))}
              {Number(r.proxima_cuota.mora) > 0 && <span> (incluye mora {bs(r.proxima_cuota.mora)})</span>}
            </div>
          </div>
        </div>
      )}

      {/* Lista de planes */}
      <div className="space-y-3">
        {data.planes.map(p => {
          const abierto = expandido === p.id;
          const activo  = p.estado === 'vigente' || p.estado === 'moroso';
          const badge   = p.estado === 'pagado' ? 'bg-green-100 text-green-700'
                        : p.estado === 'moroso' ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700';
          const label   = p.estado === 'pagado' ? 'Pagado'
                        : p.estado === 'moroso' ? 'Con mora'
                        : 'Vigente';
          return (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setExpandido(abierto ? null : p.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{p.producto_nombre}</div>
                  <div className="text-xs text-gray-500">
                    {p.numero_factura || `Crédito #${p.id}`} · {p.cuotas_pagadas}/{p.n_cuotas} cuotas pagadas
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-gray-500">Saldo</div>
                    <div className="font-bold text-gray-900">{bs(p.saldo)}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge}`}>{label}</span>
                  {abierto ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {abierto && (
                <div className="border-t border-gray-100 p-4 space-y-3">
                  {/* Datos financieros + factura de la inicial */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <Dato label="Financiado" val={bs(p.precio_financiado)} />
                    <Dato label="Recargo" val={`+${Number(p.recargo_pct)}%`} />
                    <Dato label="Inicial (pagada)" val={bs(p.inicial)} />
                    <Dato label="Cuota mensual" val={bs(p.monto_cuota)} />
                  </div>

                  {p.numero_factura && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-sm">
                        <span className="text-blue-700">Factura de la inicial:</span>{' '}
                        <strong className="text-blue-900">{p.numero_factura}</strong>
                      </div>
                      <button onClick={() => setComprobante({ tipo: 'inicial', plan: p })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium">
                        <Printer className="w-4 h-4" /> Ver comprobante
                      </button>
                    </div>
                  )}

                  {/* Tabla de cuotas */}
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
                          const ec = c.estado === 'pagada'  ? { txt: 'Pagada',   cls: 'bg-green-100 text-green-700' }
                                    : c.estado === 'vencida' ? { txt: 'Vencida',  cls: 'bg-red-100 text-red-700' }
                                    : { txt: 'Pendiente', cls: 'bg-gray-100 text-gray-600' };
                          const enProceso = pagando === c.id || verificando === c.id;
                          return (
                            <tr key={c.id} className="border-b border-gray-100">
                              <td className="px-3 py-2">{c.numero}</td>
                              <td className="px-3 py-2 text-gray-600">{fmtFecha(c.fecha_vencimiento)}</td>
                              <td className="px-3 py-2 text-right">{bs(c.monto)}</td>
                              <td className="px-3 py-2 text-right text-red-600">{Number(c.mora) > 0 ? bs(c.mora) : '—'}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ec.cls}`}>{ec.txt}</span>
                              </td>
                              <td className="px-3 py-2 text-right">
                                {c.estado === 'pagada' ? (
                                  c.numero_factura ? (
                                    <button onClick={() => setComprobante({ tipo: 'cuota', plan: p, cuota: c })}
                                      className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">
                                      <Printer className="w-3.5 h-3.5" /> {c.numero_factura}
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-400">
                                      {c.fecha_pago ? fmtFecha(c.fecha_pago) : '✓'}
                                    </span>
                                  )
                                ) : (
                                  <div className="flex justify-end gap-1 flex-wrap">
                                    {c.stripe_session_pending && (
                                      <button onClick={() => verificarPendiente(c)} disabled={enProceso}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 text-xs font-medium disabled:opacity-50">
                                        {verificando === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '¿Ya pagaste?'}
                                      </button>
                                    )}
                                    <button onClick={() => pagarStripe(c)} disabled={enProceso || activo === false}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs font-medium disabled:opacity-50">
                                      {pagando === c.id
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <><CreditCard className="w-3.5 h-3.5" /> Pagar</>}
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {p.estado === 'moroso' && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg px-3 py-2 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Este crédito tiene cuotas vencidas. Mientras tengas mora <strong>no vas a poder tomar nuevos créditos</strong>. Regularizá lo antes posible.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal comprobante imprimible */}
      {comprobante && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setComprobante(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {comprobante.tipo === 'inicial' ? 'Comprobante — Crédito' : 'Comprobante — Cuota'}
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={imprimir}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
                <button onClick={() => setComprobante(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div ref={printableRef} className="p-4">
              {comprobante.tipo === 'inicial'
                ? <ComprobanteInicial plan={comprobante.plan} />
                : <ComprobanteCuota plan={comprobante.plan} cuota={comprobante.cuota} />}
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

function Dato({ label, val }: { label: string; val: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900">{val}</div>
    </div>
  );
}

// Comprobantes imprimibles (versión resumida del template HTML del backend)
function ComprobanteInicial({ plan }: { plan: ApiPlanCredito }) {
  const recargoMonto = Number(plan.precio_financiado) - Number(plan.precio_base);
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', color: '#111827' }}>
      <div className="brand" style={{ background: '#1e40af', color: '#fff', padding: 14, borderRadius: '8px 8px 0 0' }}>
        <div style={{ fontSize: 12, letterSpacing: 2 }}>FACTURA DE CRÉDITO</div>
        <div style={{ fontSize: 20, fontWeight: 'bold' }}>{plan.numero_factura || `#${plan.id}`}</div>
      </div>
      <div className="box" style={{ border: '1px solid #e5e7eb', borderRadius: '0 0 8px 8px', padding: 12, marginTop: 0 }}>
        <p><strong>Emite:</strong> Santa Cruz Computer · NIT 1234567019 · Av. Cristo Redentor #123, Santa Cruz de la Sierra</p>
        <p><strong>Cliente:</strong> {plan.cliente_nombre}</p>
        <p><strong>Producto:</strong> {plan.producto_nombre} · {plan.cantidad} u. × Bs {Number(plan.precio_unitario).toFixed(2)}</p>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 12 }}>
        <tbody>
          <tr><td style={{ padding: 6, borderBottom: '1px solid #e5e7eb' }}>Precio base</td><td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Bs {Number(plan.precio_base).toFixed(2)}</td></tr>
          <tr><td style={{ padding: 6, borderBottom: '1px solid #e5e7eb' }}>Recargo (+{Number(plan.recargo_pct).toFixed(0)}%)</td><td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Bs {recargoMonto.toFixed(2)}</td></tr>
          <tr style={{ background: '#f9fafb', fontWeight: 'bold' }}><td style={{ padding: 8 }}>Total financiado</td><td style={{ padding: 8, textAlign: 'right', color: '#1e40af' }}>Bs {Number(plan.precio_financiado).toFixed(2)}</td></tr>
          <tr><td style={{ padding: 8, color: '#065f46' }}>💵 Inicial cobrada (efectivo)</td><td style={{ padding: 8, textAlign: 'right', color: '#065f46', fontWeight: 'bold' }}>Bs {Number(plan.inicial).toFixed(2)}</td></tr>
          <tr><td style={{ padding: 8 }}>Saldo en cuotas</td><td style={{ padding: 8, textAlign: 'right' }}>{plan.n_cuotas} × Bs {Number(plan.monto_cuota).toFixed(2)}</td></tr>
        </tbody>
      </table>
      <p style={{ marginTop: 14, fontSize: 12, color: '#6b7280', letterSpacing: 1 }}>CRONOGRAMA</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead style={{ background: '#f9fafb' }}>
          <tr>
            <th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>#</th>
            <th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Vence</th>
            <th style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Monto</th>
            <th style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {plan.cuotas.map(c => (
            <tr key={c.id}>
              <td style={{ padding: 6 }}>{c.numero}/{plan.n_cuotas}</td>
              <td style={{ padding: 6 }}>{fmtFecha(c.fecha_vencimiento)}</td>
              <td style={{ padding: 6, textAlign: 'right' }}>Bs {Number(c.monto).toFixed(2)}</td>
              <td style={{ padding: 6, textAlign: 'center', color: c.estado === 'pagada' ? '#059669' : c.estado === 'vencida' ? '#dc2626' : '#6b7280' }}>
                {c.estado === 'pagada' ? '✓ Pagada' : c.estado === 'vencida' ? '! Vencida' : 'Pendiente'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComprobanteCuota({ plan, cuota }: { plan: ApiPlanCredito; cuota: ApiCuota }) {
  const totalPagado = Number(cuota.monto) + Number(cuota.mora);
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', color: '#111827' }}>
      <div className="brand" style={{ background: '#065f46', color: '#fff', padding: 14, borderRadius: '8px 8px 0 0' }}>
        <div style={{ fontSize: 12, letterSpacing: 2 }}>RECIBO DE CUOTA</div>
        <div style={{ fontSize: 20, fontWeight: 'bold' }}>{cuota.numero_factura || '—'}</div>
      </div>
      <div className="box" style={{ border: '1px solid #e5e7eb', borderRadius: '0 0 8px 8px', padding: 12, marginTop: 0 }}>
        <p><strong>Emite:</strong> Santa Cruz Computer · NIT 1234567019</p>
        <p><strong>Cliente:</strong> {plan.cliente_nombre}</p>
        <p><strong>Crédito original:</strong> {plan.numero_factura || `#${plan.id}`} · {plan.producto_nombre}</p>
        <p><strong>Fecha de pago:</strong> {cuota.fecha_pago ? new Date(cuota.fecha_pago).toLocaleString('es-BO') : '—'}</p>
      </div>
      <div style={{ background: '#ecfdf5', border: '2px solid #10b981', borderRadius: 8, padding: 16, margin: '12px 0' }}>
        <div style={{ fontSize: 12, letterSpacing: 1, color: '#065f46' }}>✅ CUOTA {cuota.numero}/{plan.n_cuotas} PAGADA</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#065f46', marginTop: 4 }}>Bs {totalPagado.toFixed(2)}</div>
        <div style={{ fontSize: 12, color: '#065f46', marginTop: 4 }}>
          Monto: Bs {Number(cuota.monto).toFixed(2)}
          {Number(cuota.mora) > 0 && <> · Mora: Bs {Number(cuota.mora).toFixed(2)}</>}
          {' · '}Método: {cuota.metodo_pago === 'stripe' ? '💳 Tarjeta (Stripe)' : '💵 Efectivo'}
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', letterSpacing: 1 }}>PROGRESO</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {plan.cuotas.map(c => (
            <tr key={c.id}>
              <td style={{ padding: 6, textAlign: 'center', width: 30 }}>
                {c.estado === 'pagada' ? '✓' : c.estado === 'vencida' ? '!' : '·'}
              </td>
              <td style={{ padding: 6 }}>Cuota {c.numero}/{plan.n_cuotas} — vence {fmtFecha(c.fecha_vencimiento)}</td>
              <td style={{ padding: 6, textAlign: 'right', color: c.estado === 'pagada' ? '#059669' : c.estado === 'vencida' ? '#dc2626' : '#6b7280' }}>
                Bs {Number(c.monto).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, marginTop: 12 }}>
        <div style={{ fontSize: 12, color: '#1e40af', letterSpacing: 1 }}>SALDO PENDIENTE DEL CRÉDITO</div>
        <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1e40af', marginTop: 4 }}>Bs {Number(plan.saldo).toFixed(2)}</div>
      </div>
    </div>
  );
}
