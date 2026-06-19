"""
voz_views.py — Interpretación de comandos de voz con Gemini (respaldo de las reglas)

El frontend convierte la voz del admin en texto (Web Speech API) e intenta
entenderlo con reglas simples. Si las reglas no logran identificar el comando,
manda el texto AQUÍ y este endpoint consulta a Gemini para extraer la intención:
  · qué reporte: almacen | entradas | salidas | ventas | compras
  · qué formato: excel | pdf

Devuelve JSON {"reporte": "...", "formato": "..."} o {"reporte": null} si no
se pudo determinar. La clave de Gemini vive solo en el backend (settings).
"""
import json
import logging
import re
import urllib.request
import urllib.error

from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

logger = logging.getLogger(__name__)

REPORTES_VALIDOS = {
    'almacen', 'entradas', 'salidas', 'ventas', 'compras',
    'top_vendidos', 'top_comprados', 'top_clientes', 'top_proveedores',
}
FORMATOS_VALIDOS = {'excel', 'pdf', 'ambos'}
_FECHA_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')

_PROMPT = """Eres un asistente que interpreta comandos de voz en español (Bolivia)
para descargar reportes de un sistema de inventario y ventas.
La fecha de hoy es %(hoy)s (formato AAAA-MM-DD). Úsala para resolver fechas relativas.

Del texto del usuario, identifica:
- "reporte": uno de estos valores EXACTOS según lo que pida:
    * "almacen"  → stock, inventario, almacén, productos, existencias
    * "entradas" → entradas de stock, ingresos al inventario, lo que entró
    * "salidas"  → salidas de stock, lo que salió/se descontó del inventario
    * "ventas"   → ventas, historial de ventas, lo vendido, ingresos por ventas
    * "compras"  → compras a proveedores, historial de compras, lo comprado
    * "top_vendidos"    → el/los producto(s) que MÁS se vendió o vendieron
    * "top_comprados"   → el/los producto(s) que MÁS se compró a proveedores
    * "top_clientes"    → el/los cliente(s) que MÁS compró o el más frecuente
    * "top_proveedores" → el/los proveedor(es) al que MÁS se le compró
- "formato": "pdf" si menciona pdf; "excel" si menciona excel/hoja de cálculo;
   "ambos" si pide los dos (ej. "excel y pdf", "ambos", "los dos");
   si no menciona ninguno, usa "excel".
- "desde" y "hasta": rango de fechas en formato AAAA-MM-DD si el usuario menciona
   un periodo (un mes como "mayo" o "mayo de 2025"; un rango "del 1 al 15 de junio";
   "este mes", "hoy", "ayer", "últimos 7 días", "esta semana", "este año", etc.).
   Resuélvelas usando la fecha de hoy. Para un mes completo: desde = primer día y
   hasta = último día de ese mes. Si NO menciona periodo, usa null en ambos.

Responde ÚNICAMENTE un JSON válido con esta forma exacta:
{"reporte": "<valor o null>", "formato": "<excel|pdf|ambos>", "desde": "<AAAA-MM-DD o null>", "hasta": "<AAAA-MM-DD o null>"}
Si no logras identificar el reporte, usa null en "reporte".

Texto del usuario: "%(texto)s"
"""


class VozIntencionView(APIView):
    """POST {texto} → {reporte, formato}. Usa Gemini para interpretar el comando."""
    permission_classes = [AllowAny]

    def post(self, request):
        texto = (request.data.get('texto') or '').strip()
        if not texto:
            return Response({'error': 'Falta el texto del comando.'},
                            status=status.HTTP_400_BAD_REQUEST)

        api_key = settings.GEMINI_API_KEY
        if not api_key:
            return Response({'error': 'Gemini no está configurado en el servidor.',
                             'reporte': None}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            data = self._consultar_gemini(api_key, texto)
        except Exception as exc:
            logger.error(f'Gemini voz-intencion falló: {exc}')
            return Response({'error': 'No se pudo interpretar el comando.',
                             'reporte': None}, status=status.HTTP_502_BAD_GATEWAY)

        reporte = data.get('reporte')
        formato = data.get('formato') or 'excel'
        desde = data.get('desde')
        hasta = data.get('hasta')
        if reporte not in REPORTES_VALIDOS:
            reporte = None
        if formato not in FORMATOS_VALIDOS:
            formato = 'excel'
        if not (isinstance(desde, str) and _FECHA_RE.match(desde)):
            desde = None
        if not (isinstance(hasta, str) and _FECHA_RE.match(hasta)):
            hasta = None
        return Response({'reporte': reporte, 'formato': formato,
                         'desde': desde, 'hasta': hasta})

    def _consultar_gemini(self, api_key, texto):
        url = (f'https://generativelanguage.googleapis.com/v1beta/models/'
               f'{settings.GEMINI_MODEL}:generateContent')
        hoy = timezone.localdate().isoformat()
        payload = {
            'contents': [{'parts': [{'text': _PROMPT % {'hoy': hoy, 'texto': texto}}]}],
            'generationConfig': {'temperature': 0, 'responseMimeType': 'application/json'},
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json', 'x-goog-api-key': api_key},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=12) as resp:
            body = json.loads(resp.read().decode('utf-8'))
        # Extraer el texto JSON que devolvió el modelo
        parts = body['candidates'][0]['content']['parts'][0]['text']
        return json.loads(parts)
