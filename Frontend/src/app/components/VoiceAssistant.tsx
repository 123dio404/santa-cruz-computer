/**
 * VoiceAssistant.tsx - Asistente de voz para descargar reportes (solo admin)
 *
 * Botón flotante de micrófono. El admin dice un comando como
 * "descargar inventario en excel" o "reporte de ventas en pdf" y el sistema:
 *   1. Convierte la voz a texto con Web Speech API (es-BO, gratis, Chrome/Edge).
 *   2. Intenta entenderlo con reglas locales (parseIntent).
 *   3. Si las reglas no logran identificar el reporte, manda el texto al backend
 *      que consulta a Gemini (vozAPI.interpretar).
 *   4. Genera y descarga el reporte (Excel o PDF) con generarReporte.
 *   5. Confirma por voz con SpeechSynthesis.
 *
 * Solo se monta para el rol admin (ver Layout.tsx).
 */
import { useState, useRef, useEffect } from 'react';
import { Mic, X, Loader2, User, Truck } from 'lucide-react';
import { vozAPI, clientesAPI, proveedoresAPI, ventasAPI, API_BASE_URL } from '../services/api';
import type { VozIntencion, VozFormato, ApiCliente, ApiProveedor } from '../services/api';
import {
  parseIntent, requiereIA, generarReporte, REPORTE_LABEL,
  generarFacturasCliente, generarComprasProveedor, buscarClientes, buscarProveedores,
} from '../utils/vozReportes';
import type { Rango } from '../utils/vozReportes';

type Estado = 'idle' | 'escuchando' | 'procesando' | 'ok' | 'error';

// Cuando un nombre dictado coincide con varios registros, se ofrece esta lista
// para que el admin toque el correcto (desambiguación visual).
type Pendiente =
  | { tipo: 'cliente'; opciones: ApiCliente[]; formato: VozFormato; rango?: Rango }
  | { tipo: 'proveedor'; opciones: ApiProveedor[]; formato: VozFormato; rango?: Rango };

// Web Speech API no está tipada en TS estándar
const SpeechRecognitionCtor =
  (typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;

// "2026-05-01" → "01/05/2026"; arma una frase legible del periodo.
const isoBO = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
function rangoTexto(desde?: string | null, hasta?: string | null): string {
  if (desde && hasta) return desde === hasta ? `el ${isoBO(desde)}` : `del ${isoBO(desde)} al ${isoBO(hasta)}`;
  if (desde) return `desde ${isoBO(desde)}`;
  if (hasta) return `hasta ${isoBO(hasta)}`;
  return '';
}

function hablar(texto: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-BO';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* TTS opcional */ }
}

export function VoiceAssistant() {
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState<Estado>('idle');
  const [transcript, setTranscript] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const recRef = useRef<any>(null);
  // Cache en memoria para no recargar clientes/proveedores en cada comando.
  const clientesRef = useRef<ApiCliente[] | null>(null);
  const proveedoresRef = useRef<ApiProveedor[] | null>(null);
  const soportado = !!SpeechRecognitionCtor;

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* noop */ } }, []);

  const getClientes = async () =>
    clientesRef.current ?? (clientesRef.current = await clientesAPI.getAll());
  const getProveedores = async () =>
    proveedoresRef.current ?? (proveedoresRef.current = await proveedoresAPI.getAll());

  // Genera el reporte una vez resuelto el cliente/proveedor concreto.
  const finalizarCliente = async (cliente: ApiCliente, formato: VozFormato, rango?: Rango) => {
    const nombre = `${cliente.nombre} ${cliente.apellido}`.trim();
    const formatoTxt = formato === 'ambos' ? 'Excel y PDF' : formato.toUpperCase();
    setPendiente(null);
    setEstado('procesando');
    setMensaje(`Descargando facturas de ${nombre} (${formatoTxt})...`);
    hablar(`Descargando las facturas de ${nombre}`);
    try {
      await generarFacturasCliente(cliente, formato, rango);
      setEstado('ok');
      setMensaje(`✓ Facturas de ${nombre} — ${formatoTxt}`);
    } catch (err: any) {
      setEstado('error');
      setMensaje(err?.message || 'No se pudieron generar las facturas.');
    }
  };

  const finalizarProveedor = async (prov: ApiProveedor, formato: VozFormato, rango?: Rango) => {
    const nombre = prov.nombre_empresa;
    const formatoTxt = formato === 'ambos' ? 'Excel y PDF' : formato.toUpperCase();
    setPendiente(null);
    setEstado('procesando');
    setMensaje(`Descargando compras al proveedor ${nombre} (${formatoTxt})...`);
    hablar(`Descargando las compras al proveedor ${nombre}`);
    try {
      await generarComprasProveedor(prov, formato, rango);
      setEstado('ok');
      setMensaje(`✓ Compras a ${nombre} — ${formatoTxt}`);
    } catch (err: any) {
      setEstado('error');
      setMensaje(err?.message || 'No se pudieron generar las compras.');
    }
  };

  const elegirPendiente = (item: ApiCliente | ApiProveedor) => {
    if (!pendiente) return;
    if (pendiente.tipo === 'cliente') finalizarCliente(item as ApiCliente, pendiente.formato, pendiente.rango);
    else finalizarProveedor(item as ApiProveedor, pendiente.formato, pendiente.rango);
  };

  const ejecutarComando = async (texto: string) => {
    setEstado('procesando');
    setPendiente(null);
    setMensaje('Interpretando el comando...');
    try {
      // 1) Reglas locales (reporte + formato + periodo)
      let intencion: VozIntencion | null = parseIntent(texto);
      // 2) Respaldo con Gemini si no hay reporte o quedaron datos sin resolver
      if (!intencion || !intencion.reporte || requiereIA(texto, intencion)) {
        try {
          const g = await vozAPI.interpretar(texto);
          if (g.reporte) {
            intencion = {
              reporte: g.reporte,
              formato: g.formato || intencion?.formato || 'excel',
              desde: g.desde ?? intencion?.desde ?? null,
              hasta: g.hasta ?? intencion?.hasta ?? null,
              numero_venta: g.numero_venta ?? intencion?.numero_venta ?? null,
              cliente_nombre: g.cliente_nombre ?? intencion?.cliente_nombre ?? null,
              proveedor_nombre: g.proveedor_nombre ?? intencion?.proveedor_nombre ?? null,
            };
          }
        } catch { /* si Gemini falla, seguimos con lo que dieron las reglas */ }
      }
      if (!intencion || !intencion.reporte) {
        setEstado('error');
        setMensaje('No entendí qué reporte quieres. Intenta: "inventario en excel" o "ventas de mayo en pdf".');
        hablar('No entendí qué reporte quieres descargar.');
        return;
      }

      const { reporte, formato } = intencion;
      const rango: Rango | undefined =
        (intencion.desde || intencion.hasta) ? { desde: intencion.desde, hasta: intencion.hasta } : undefined;

      // ── Etapa 3a: factura por número (descarga directa) ──────────────────────
      if (reporte === 'factura') {
        const n = intencion.numero_venta;
        if (!n) {
          setEstado('error');
          setMensaje('No entendí el número de factura. Intenta: "factura número 21".');
          hablar('No entendí el número de la factura.');
          return;
        }
        setMensaje(`Buscando la factura número ${n}...`);
        try {
          const venta = await ventasAPI.getById(n);
          if (venta.status !== 'completed') {
            setEstado('error');
            setMensaje(`La factura #${n} aún no está completada; no se puede descargar.`);
            hablar(`La factura número ${n} todavía no está completada.`);
            return;
          }
          window.open(`${API_BASE_URL}/orders/ventas/${n}/pdf/`, '_blank');
          setEstado('ok');
          setMensaje(`✓ Factura #${n} abierta en una pestaña nueva.`);
          hablar(`Abriendo la factura número ${n}`);
        } catch {
          setEstado('error');
          setMensaje(`No encontré la factura número ${n}.`);
          hablar(`No encontré la factura número ${n}.`);
        }
        return;
      }

      // ── Etapa 3b: facturas de un cliente concreto ────────────────────────────
      if (reporte === 'facturas_cliente') {
        const nombre = (intencion.cliente_nombre || '').trim();
        if (!nombre) {
          setEstado('error');
          setMensaje('No entendí el nombre del cliente. Intenta: "facturas del cliente Juan Pérez".');
          hablar('No entendí el nombre del cliente.');
          return;
        }
        setMensaje(`Buscando al cliente "${nombre}"...`);
        const matches = buscarClientes(nombre, await getClientes());
        if (matches.length === 0) {
          setEstado('error');
          setMensaje(`No encontré ningún cliente llamado "${nombre}".`);
          hablar(`No encontré un cliente llamado ${nombre}.`);
          return;
        }
        if (matches.length === 1) { await finalizarCliente(matches[0], formato, rango); return; }
        setEstado('idle');
        setMensaje(`Encontré ${matches.length} clientes parecidos a "${nombre}". Toca el correcto:`);
        hablar('Encontré varios clientes. Elige el correcto en la lista.');
        setPendiente({ tipo: 'cliente', opciones: matches.slice(0, 8), formato, rango });
        return;
      }

      // ── Etapa 3c: compras a un proveedor concreto ────────────────────────────
      if (reporte === 'compras_proveedor') {
        const nombre = (intencion.proveedor_nombre || '').trim();
        if (!nombre) {
          setEstado('error');
          setMensaje('No entendí el nombre del proveedor. Intenta: "compras al proveedor TecnoBol".');
          hablar('No entendí el nombre del proveedor.');
          return;
        }
        setMensaje(`Buscando al proveedor "${nombre}"...`);
        const matches = buscarProveedores(nombre, await getProveedores());
        if (matches.length === 0) {
          setEstado('error');
          setMensaje(`No encontré ningún proveedor llamado "${nombre}".`);
          hablar(`No encontré un proveedor llamado ${nombre}.`);
          return;
        }
        if (matches.length === 1) { await finalizarProveedor(matches[0], formato, rango); return; }
        setEstado('idle');
        setMensaje(`Encontré ${matches.length} proveedores parecidos a "${nombre}". Toca el correcto:`);
        hablar('Encontré varios proveedores. Elige el correcto en la lista.');
        setPendiente({ tipo: 'proveedor', opciones: matches.slice(0, 8), formato, rango });
        return;
      }

      // ── Reportes normales (almacén, ventas, compras, rankings…) ──────────────
      const label = REPORTE_LABEL[reporte];
      const formatoTxt = formato === 'ambos' ? 'Excel y PDF' : formato.toUpperCase();
      const periodoTxt = rangoTexto(intencion.desde, intencion.hasta);
      setMensaje(`Descargando: ${label} (${formatoTxt})${periodoTxt ? ` · ${periodoTxt}` : ''}`);
      hablar(`Descargando reporte de ${label}${periodoTxt ? `, ${periodoTxt},` : ''} en ${formato === 'ambos' ? 'excel y pdf' : formato}`);
      await generarReporte(reporte, formato, rango);
      setEstado('ok');
      setMensaje(`✓ ${label} — ${formatoTxt}${periodoTxt ? ` · ${periodoTxt}` : ''}`);
    } catch (err: any) {
      setEstado('error');
      setMensaje(err?.message || 'No se pudo generar el reporte.');
    }
  };

  const iniciarEscucha = () => {
    if (!soportado) return;
    setTranscript('');
    setMensaje('');
    setPendiente(null);
    setEstado('escuchando');
    const rec = new SpeechRecognitionCtor();
    rec.lang = 'es-BO';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      const texto = Array.from(e.results).map((r: any) => r[0].transcript).join('');
      setTranscript(texto);
      if (e.results[e.results.length - 1].isFinal) {
        ejecutarComando(texto.trim());
      }
    };
    rec.onerror = (e: any) => {
      setEstado('error');
      setMensaje(e?.error === 'not-allowed'
        ? 'Permiso de micrófono denegado. Actívalo en el navegador.'
        : 'No se pudo escuchar. Revisa el micrófono.');
    };
    rec.onend = () => {
      setEstado(prev => (prev === 'escuchando' ? 'idle' : prev));
    };

    recRef.current = rec;
    try { rec.start(); } catch { /* doble start */ }
  };

  const detener = () => {
    try { recRef.current?.stop(); } catch { /* noop */ }
  };

  const abrir = () => {
    setAbierto(true);
    setEstado('idle');
    setTranscript('');
    setMensaje('');
    setPendiente(null);
  };
  const cerrar = () => {
    detener();
    setAbierto(false);
  };

  return (
    <>
      {/* Botón flotante */}
      {!abierto && (
        <button
          onClick={abrir}
          title="Asistente de voz para reportes"
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 flex items-center justify-center transition-transform hover:scale-105"
        >
          <Mic className="w-6 h-6" />
        </button>
      )}

      {/* Panel */}
      {abierto && (
        <div className="fixed bottom-6 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              <span className="font-semibold text-sm">Reportes por voz</span>
            </div>
            <button onClick={cerrar} className="p-1 hover:bg-blue-500 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {!soportado ? (
              <p className="text-sm text-red-600">
                Tu navegador no soporta el reconocimiento de voz. Usa Chrome o Edge.
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-500">
                  Ejemplos: <span className="italic">"ventas de mayo en pdf"</span>,{' '}
                  <span className="italic">"inventario en excel y pdf"</span>,{' '}
                  <span className="italic">"producto más vendido este mes"</span>,{' '}
                  <span className="italic">"ventas del 10 de mayo"</span>,{' '}
                  <span className="italic">"factura número 21"</span>,{' '}
                  <span className="italic">"facturas del cliente Juan Pérez"</span>,{' '}
                  <span className="italic">"compras al proveedor TecnoBol"</span>.
                </p>

                {/* Transcript / estado */}
                <div className="min-h-[48px] bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                  {transcript
                    ? <span>"{transcript}"</span>
                    : <span className="text-gray-400">Pulsa el micrófono y habla...</span>}
                </div>

                {mensaje && (
                  <div className={`text-sm rounded-lg p-2 ${
                    estado === 'error' ? 'bg-red-50 text-red-700'
                      : estado === 'ok' ? 'bg-green-50 text-green-700'
                      : 'bg-blue-50 text-blue-700'
                  }`}>
                    {mensaje}
                  </div>
                )}

                {/* Lista de desambiguación: varios clientes/proveedores parecidos */}
                {pendiente && (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {pendiente.opciones.map((o: any) => (
                      <button
                        key={o.id}
                        onClick={() => elegirPendiente(o)}
                        className="w-full flex items-center gap-2 text-left p-2 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                      >
                        {pendiente.tipo === 'cliente'
                          ? <User className="w-4 h-4 text-blue-600 shrink-0" />
                          : <Truck className="w-4 h-4 text-blue-600 shrink-0" />}
                        <span className="text-sm text-gray-800">
                          {pendiente.tipo === 'cliente' ? (
                            <>
                              <strong>{o.nombre} {o.apellido}</strong>
                              {o.usuario_login && <span className="text-gray-500"> · @{o.usuario_login}</span>}
                              {o.ciudad && <span className="text-gray-400"> · {o.ciudad}</span>}
                            </>
                          ) : (
                            <>
                              <strong>{o.nombre_empresa}</strong>
                              {o.contacto_nombre && <span className="text-gray-500"> · {o.contacto_nombre}</span>}
                              {o.ciudad && <span className="text-gray-400"> · {o.ciudad}</span>}
                            </>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Botón micrófono */}
                {estado === 'escuchando' ? (
                  <button
                    onClick={detener}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-500 text-white rounded-xl font-medium animate-pulse"
                  >
                    <Mic className="w-5 h-5" /> Escuchando... (toca para detener)
                  </button>
                ) : estado === 'procesando' ? (
                  <button disabled className="w-full flex items-center justify-center gap-2 py-3 bg-gray-300 text-gray-600 rounded-xl font-medium">
                    <Loader2 className="w-5 h-5 animate-spin" /> Procesando...
                  </button>
                ) : (
                  <button
                    onClick={iniciarEscucha}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                  >
                    <Mic className="w-5 h-5" /> Hablar
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
