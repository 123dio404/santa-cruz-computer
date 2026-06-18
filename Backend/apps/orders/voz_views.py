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
import urllib.request
import urllib.error

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

logger = logging.getLogger(__name__)

REPORTES_VALIDOS = {'almacen', 'entradas', 'salidas', 'ventas', 'compras'}
FORMATOS_VALIDOS = {'excel', 'pdf'}

_PROMPT = """Eres un asistente que interpreta comandos de voz en español (Bolivia)
para descargar reportes de un sistema de inventario y ventas.

Del texto del usuario, identifica:
- "reporte": uno de estos valores EXACTOS según lo que pida:
    * "almacen"  → stock, inventario, almacén, productos, existencias
    * "entradas" → entradas de stock, ingresos, lo que entró al inventario
    * "salidas"  → salidas de stock, lo que salió/se descontó del inventario
    * "ventas"   → ventas, historial de ventas, lo vendido, ingresos por ventas
    * "compras"  → compras a proveedores, historial de compras, lo comprado a proveedores
- "formato": "pdf" si menciona pdf; "excel" si menciona excel/hoja de cálculo;
   si no menciona ninguno, usa "excel".

Responde ÚNICAMENTE un JSON válido con esta forma:
{"reporte": "<valor o null>", "formato": "<excel|pdf>"}
Si no logras identificar el reporte, usa null en "reporte".

Texto del usuario: "%s"
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
        if reporte not in REPORTES_VALIDOS:
            reporte = None
        if formato not in FORMATOS_VALIDOS:
            formato = 'excel'
        return Response({'reporte': reporte, 'formato': formato})

    def _consultar_gemini(self, api_key, texto):
        url = (f'https://generativelanguage.googleapis.com/v1beta/models/'
               f'{settings.GEMINI_MODEL}:generateContent')
        payload = {
            'contents': [{'parts': [{'text': _PROMPT % texto}]}],
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
