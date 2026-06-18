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
import { Mic, X, Loader2 } from 'lucide-react';
import { vozAPI } from '../services/api';
import { parseIntent, generarReporte, REPORTE_LABEL } from '../utils/vozReportes';

type Estado = 'idle' | 'escuchando' | 'procesando' | 'ok' | 'error';

// Web Speech API no está tipada en TS estándar
const SpeechRecognitionCtor =
  (typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;

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
  const recRef = useRef<any>(null);
  const soportado = !!SpeechRecognitionCtor;

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* noop */ } }, []);

  const ejecutarComando = async (texto: string) => {
    setEstado('procesando');
    setMensaje('Interpretando el comando...');
    try {
      // 1) Reglas locales
      let intencion = parseIntent(texto);
      // 2) Respaldo con Gemini si las reglas no entienden
      if (!intencion || !intencion.reporte) {
        try {
          const g = await vozAPI.interpretar(texto);
          if (g.reporte) intencion = { reporte: g.reporte, formato: g.formato };
        } catch { /* si Gemini falla, seguimos sin intención */ }
      }
      if (!intencion || !intencion.reporte) {
        setEstado('error');
        const msg = 'No entendí qué reporte quieres. Intenta: "inventario en excel" o "ventas en pdf".';
        setMensaje(msg);
        hablar('No entendí qué reporte quieres descargar.');
        return;
      }
      const { reporte, formato } = intencion;
      const label = REPORTE_LABEL[reporte];
      setMensaje(`Descargando: ${label} en ${formato.toUpperCase()}`);
      hablar(`Descargando reporte de ${label} en ${formato}`);
      await generarReporte(reporte, formato);
      setEstado('ok');
      setMensaje(`✓ ${label} — ${formato.toUpperCase()}`);
    } catch (err: any) {
      setEstado('error');
      setMensaje(err?.message || 'No se pudo generar el reporte.');
    }
  };

  const iniciarEscucha = () => {
    if (!soportado) return;
    setTranscript('');
    setMensaje('');
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
                  Ejemplos: <span className="italic">"inventario en excel"</span>,{' '}
                  <span className="italic">"ventas en pdf"</span>,{' '}
                  <span className="italic">"compras a proveedores"</span>.
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
