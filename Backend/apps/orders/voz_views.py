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
from apps.users.permissions import IsAuthenticatedJWT

logger = logging.getLogger(__name__)

REPORTES_VALIDOS = {
    'almacen', 'entradas', 'salidas', 'ventas', 'compras',
    'top_vendidos', 'top_comprados', 'top_clientes', 'top_proveedores',
    'factura', 'facturas_cliente', 'compras_proveedor',
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
    * "factura"            → la factura de UNA venta concreta por su NÚMERO
                            (ej. "factura número 21", "la factura 7")
    * "facturas_cliente"   → las facturas/ventas/historial de UN cliente concreto
                            por su NOMBRE (ej. "facturas del cliente Juan Pérez")
    * "compras_proveedor"  → las compras/historial a UN proveedor concreto por su
                            NOMBRE (ej. "compras al proveedor TecnoBol")
- "formato": "pdf" si menciona pdf; "excel" si menciona excel/hoja de cálculo;
   "ambos" si pide los dos (ej. "excel y pdf", "ambos", "los dos");
   si no menciona ninguno, usa "excel".
- "desde" y "hasta": rango de fechas en formato AAAA-MM-DD si el usuario menciona
   un periodo (un mes como "mayo" o "mayo de 2025"; un rango "del 1 al 15 de junio";
   UN DÍA concreto como "el 10 de mayo de 2026" → desde = hasta = ese día;
   "este mes", "hoy", "ayer", "últimos 7 días", "esta semana", "este año", etc.).
   Resuélvelas usando la fecha de hoy. Para un mes completo: desde = primer día y
   hasta = último día de ese mes. Si NO menciona periodo, usa null en ambos.
- "numero_venta": SOLO si el reporte es "factura"; el número entero de la venta/factura
   (ej. "factura número 21" → 21). Si no aplica, usa null.
- "cliente_nombre": SOLO si el reporte es "facturas_cliente"; el nombre del cliente tal
   como se dictó (ej. "Juan Pérez"). Si no aplica, usa null.
- "proveedor_nombre": SOLO si el reporte es "compras_proveedor"; el nombre del proveedor
   tal como se dictó (ej. "TecnoBol"). Si no aplica, usa null.

Responde ÚNICAMENTE un JSON válido con esta forma exacta:
{"reporte": "<valor o null>", "formato": "<excel|pdf|ambos>", "desde": "<AAAA-MM-DD o null>", "hasta": "<AAAA-MM-DD o null>", "numero_venta": <entero o null>, "cliente_nombre": "<texto o null>", "proveedor_nombre": "<texto o null>"}
Si no logras identificar el reporte, usa null en "reporte".

Texto del usuario: "%(texto)s"
"""


class VozIntencionView(APIView):
    """POST {texto} → {reporte, formato}. Usa Gemini para interpretar el comando."""
    permission_classes = [IsAuthenticatedJWT]

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
        numero_venta = data.get('numero_venta')
        cliente_nombre = data.get('cliente_nombre')
        proveedor_nombre = data.get('proveedor_nombre')
        if reporte not in REPORTES_VALIDOS:
            reporte = None
        if formato not in FORMATOS_VALIDOS:
            formato = 'excel'
        if not (isinstance(desde, str) and _FECHA_RE.match(desde)):
            desde = None
        if not (isinstance(hasta, str) and _FECHA_RE.match(hasta)):
            hasta = None
        # numero_venta: acepta entero o dígitos en texto; si no, null
        try:
            numero_venta = int(numero_venta) if numero_venta not in (None, '') else None
        except (TypeError, ValueError):
            numero_venta = None
        cliente_nombre = cliente_nombre.strip() if isinstance(cliente_nombre, str) and cliente_nombre.strip() else None
        proveedor_nombre = proveedor_nombre.strip() if isinstance(proveedor_nombre, str) and proveedor_nombre.strip() else None
        return Response({'reporte': reporte, 'formato': formato,
                         'desde': desde, 'hasta': hasta,
                         'numero_venta': numero_venta,
                         'cliente_nombre': cliente_nombre,
                         'proveedor_nombre': proveedor_nombre})

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
