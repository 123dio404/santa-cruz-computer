/**
 * vozReportes.ts - Generación de reportes disparada por voz
 *
 * Centraliza, para el asistente de voz (solo admin):
 *  1. parseIntent(texto): reglas locales que detectan reporte + formato + periodo
 *     (mes, rango de días, "hoy", "este mes", "este año"…) y rankings, sin IA.
 *  2. requiereIA(texto, intencion): decide si conviene confirmar con Gemini
 *     (cuando hay palabras de fecha/ranking que las reglas no resolvieron).
 *  3. generarReporte(reporte, formato, rango): trae los datos con las APIs
 *     existentes, los filtra por rango de fechas y exporta en Excel, PDF o ambos.
 *
 * Reportes: almacen | entradas | salidas | ventas | compras
 *           | top_vendidos | top_comprados | top_clientes | top_proveedores.
 * Funciona desde cualquier pantalla porque trae sus propios datos.
 */
import { productosAPI, ventasAPI, comprasAPI } from '../services/api';
import type { VozReporte, VozFormato, VozIntencion, ApiCliente, ApiProveedor } from '../services/api';
import { exportToExcel } from './exportExcel';

export const REPORTE_LABEL: Record<VozReporte, string> = {
  almacen:           'Almacén (stock)',
  entradas:          'Entradas de stock',
  salidas:           'Salidas de stock',
  ventas:            'Ventas',
  compras:           'Compras a proveedores',
  top_vendidos:      'Productos más vendidos',
  top_comprados:     'Productos más comprados',
  top_clientes:      'Clientes más frecuentes',
  top_proveedores:   'Proveedores con más compras',
  factura:           'Factura por número',
  facturas_cliente:  'Facturas de un cliente',
  compras_proveedor: 'Compras a un proveedor',
};

export type Rango = { desde?: string | null; hasta?: string | null };

// Quita acentos y pasa a minúsculas para que las reglas sean tolerantes a la voz.
const DIACRITICOS = /[̀-ͯ]/g;
const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(DIACRITICOS, '');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const isoOf = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const ultimoDia = (y: number, m1: number) => new Date(y, m1, 0).getDate();

// ── 1. Detección de periodo (fechas) sin IA ───────────────────────────────────
function parseFechas(t: string): Rango | null {
  const now = new Date();
  const Y = now.getFullYear();
  const hoy = isoOf(Y, now.getMonth() + 1, now.getDate());

  if (/\bhoy\b/.test(t)) return { desde: hoy, hasta: hoy };
  if (/\bayer\b/.test(t)) {
    const d = new Date(now); d.setDate(d.getDate() - 1);
    const i = isoOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return { desde: i, hasta: i };
  }

  let m: RegExpMatchArray | null;
  if ((m = t.match(/ultim\w*\s+(\d{1,3})\s+dias/))) {
    const n = Math.max(1, parseInt(m[1], 10));
    const d = new Date(now); d.setDate(d.getDate() - (n - 1));
    return { desde: isoOf(d.getFullYear(), d.getMonth() + 1, d.getDate()), hasta: hoy };
  }
  if (/(esta semana|ultima semana|semana pasada)/.test(t)) {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    return { desde: isoOf(d.getFullYear(), d.getMonth() + 1, d.getDate()), hasta: hoy };
  }

  const idxMes = (name: string) => {
    const i = MESES.indexOf(name);
    if (i >= 0) return i + 1;
    return name === 'setiembre' ? 9 : -1;
  };

  // "del 1 al 15 de junio [de 2025]"
  if ((m = t.match(/del\s+(\d{1,2})\s+al\s+(\d{1,2})\s+de\s+([a-z]+)(?:\s+(?:de\s+)?(20\d{2}))?/))) {
    const mi = idxMes(m[3]);
    if (mi > 0) {
      const yy = m[4] ? parseInt(m[4], 10) : Y;
      const d1 = Math.min(+m[1], +m[2]);
      const d2 = Math.min(Math.max(+m[1], +m[2]), ultimoDia(yy, mi));
      return { desde: isoOf(yy, mi, d1), hasta: isoOf(yy, mi, d2) };
    }
  }

  // Día específico con mes nombrado ("10 de mayo [de 2026]", "el 3 de junio")
  // Va ANTES del mes completo para que el día gane sobre el mes entero.
  if ((m = t.match(/\b(\d{1,2})\s+de\s+([a-z]+)(?:\s+(?:de(?:l)?\s+)?(20\d{2}))?/))) {
    const mi = idxMes(m[2]);
    if (mi > 0) {
      const yy = m[3] ? parseInt(m[3], 10) : Y;
      const d = Math.min(Math.max(1, +m[1]), ultimoDia(yy, mi));
      const iso = isoOf(yy, mi, d);
      return { desde: iso, hasta: iso };
    }
  }

  // Mes nombrado ("mayo", "mayo de 2025") → mes completo
  for (let i = 0; i < MESES.length; i++) {
    if (new RegExp(`\\b${MESES[i]}\\b`).test(t) || (i === 8 && /\bsetiembre\b/.test(t))) {
      const ym = t.match(/\b(20\d{2})\b/);
      const yy = ym ? parseInt(ym[1], 10) : Y;
      const mi = i + 1;
      return { desde: isoOf(yy, mi, 1), hasta: isoOf(yy, mi, ultimoDia(yy, mi)) };
    }
  }

  if (/(este mes|mes actual)/.test(t)) {
    const mi = now.getMonth() + 1;
    return { desde: isoOf(Y, mi, 1), hasta: isoOf(Y, mi, ultimoDia(Y, mi)) };
  }
  if (/(este ano|ano actual)/.test(t)) return { desde: isoOf(Y, 1, 1), hasta: isoOf(Y, 12, 31) };
  const ym = t.match(/\b(20\d{2})\b/);
  if (ym) { const yy = parseInt(ym[1], 10); return { desde: isoOf(yy, 1, 1), hasta: isoOf(yy, 12, 31) }; }

  return null;
}

// Recorta lo que sigue a "cliente "/"proveedor " hasta toparse con una palabra de
// formato o de fecha; lo que queda es el nombre dictado. Texto ya normalizado.
const CORTE_NOMBRE = /\b(excel|pdf|ambos|los dos|hoy|ayer|esta semana|este mes|este ano|ultim\w+|del \d|en (?:excel|pdf|ambos|formato)|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|20\d{2}|por favor|porfa|gracias)\b/;
function extraerNombre(t: string, clave: RegExp): string {
  const m = t.match(clave);
  if (!m) return '';
  let resto = t.slice((m.index ?? 0) + m[0].length).trim();
  const corte = resto.search(CORTE_NOMBRE);
  if (corte >= 0) resto = resto.slice(0, corte);
  return resto.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── 2. Reglas locales (reporte + formato + periodo) ───────────────────────────
export function parseIntent(textoRaw: string): VozIntencion | null {
  const t = norm(textoRaw);

  // Formato: "ambos" si pide los dos; pdf si lo menciona; excel por defecto.
  let formato: VozFormato = 'excel';
  if (/(ambos|los dos|excel y pdf|pdf y excel|en excel y|y en pdf)/.test(t)) formato = 'ambos';
  else if (/\bpdf\b/.test(t)) formato = 'pdf';

  // Límites de palabra para que un nombre con "mas" (p. ej. "Tomás") no se
  // confunda con el ranking "el que más compró".
  const tieneRanking = /\b(mas|mayor|top|frecuente|mejor)\b/.test(t);

  // ── Etapa 3 (más específicos que ventas/compras genéricos) ───────────────────
  // Factura por número: "factura 21", "factura numero 21", "la factura n° 7".
  let mn: RegExpMatchArray | null;
  if (/\bfactura/.test(t) && !/\bcliente\b/.test(t) &&
      (mn = t.match(/factura\s+(?:nro\.?\s+|numero\s+|n[°º]\s*|#\s*)?(\d{1,7})\b/))) {
    return { reporte: 'factura', formato, numero_venta: parseInt(mn[1], 10),
             desde: null, hasta: null };
  }
  // Facturas/historial de un cliente concreto (no ranking).
  if (!tieneRanking && /\bcliente[a]?\b/.test(t) &&
      /(factura|venta|ventas|historial|compr|pedido)/.test(t)) {
    const nombre = extraerNombre(t, /\b(?:al |del |de la |de |el |la )?cliente[a]? /);
    const r = parseFechas(t);
    return { reporte: 'facturas_cliente', formato, cliente_nombre: nombre || null,
             desde: r?.desde ?? null, hasta: r?.hasta ?? null };
  }
  // Compras a un proveedor concreto (no ranking y con un nombre detrás de "proveedor").
  if (!tieneRanking && /\bproveedor\b/.test(t)) {
    const nombre = extraerNombre(t, /\b(?:al |del |de la |de |el |la )?proveedor /);
    if (nombre) {
      const r = parseFechas(t);
      return { reporte: 'compras_proveedor', formato, proveedor_nombre: nombre,
               desde: r?.desde ?? null, hasta: r?.hasta ?? null };
    }
  }
  let reporte: VozReporte | null = null;

  // Rankings primero (más específicos que los listados normales).
  if (tieneRanking && /proveedor/.test(t)) reporte = 'top_proveedores';
  else if (tieneRanking && /cliente/.test(t)) reporte = 'top_clientes';
  else if (tieneRanking && /(vendid|vendi|vendio|vende|venta)/.test(t)) reporte = 'top_vendidos';
  else if (tieneRanking && /(comprad|compre|compro|compr)/.test(t) && /(producto|articulo|item)/.test(t)) reporte = 'top_comprados';

  // Listados normales (orden: compras/ventas antes que entradas/salidas genéricas).
  if (!reporte) {
    if (/\b(compra|compras|proveedor|proveedores)\b/.test(t)) reporte = 'compras';
    else if (/\b(venta|ventas|vendido|vendidas?)\b/.test(t)) reporte = 'ventas';
    else if (/\b(entrada|entradas|ingreso|ingresos)\b/.test(t)) reporte = 'entradas';
    else if (/\b(salida|salidas|egreso|egresos)\b/.test(t)) reporte = 'salidas';
    else if (/\b(almacen|inventario|stock|producto|productos|existencias?)\b/.test(t)) reporte = 'almacen';
  }

  if (!reporte) return null;
  const rango = parseFechas(t);
  return { reporte, formato, desde: rango?.desde ?? null, hasta: rango?.hasta ?? null };
}

// ¿Conviene confirmar con Gemini? Cuando hay pistas de fecha/ranking sin resolver.
const HINT_TEMPORAL = /(mes|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|semana|dia|dias|hoy|ayer|ano|trimestre|del \d)/;
const HINT_RANKING = /(mas|mayor|top|frecuente|menos|mejor)/;
export function requiereIA(textoRaw: string, intencion: VozIntencion | null): boolean {
  // Número de factura ya queda resuelto por reglas → no hace falta Gemini.
  if (intencion?.reporte === 'factura') return false;
  // Nombre dictado no resuelto localmente → pedir a Gemini que lo extraiga.
  if (intencion?.reporte === 'facturas_cliente' && !intencion.cliente_nombre) return true;
  if (intencion?.reporte === 'compras_proveedor' && !intencion.proveedor_nombre) return true;
  const t = norm(textoRaw);
  const tieneRango = !!(intencion && (intencion.desde || intencion.hasta));
  const esRanking = !!(intencion?.reporte && intencion.reporte.startsWith('top_'));
  if (HINT_TEMPORAL.test(t) && !tieneRango) return true;
  if (HINT_RANKING.test(t) && !esRanking) return true;
  return false;
}

// ── Helpers de fecha / periodo ────────────────────────────────────────────────
const hoyISO = () => {
  const d = new Date();
  return isoOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
};
const isoToBO = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const fechaBO = (f: string) => isoToBO((f || '').slice(0, 10));

function enRango(fechaRaw: string, rango?: Rango): boolean {
  if (!rango || (!rango.desde && !rango.hasta)) return true;
  const f = (fechaRaw || '').slice(0, 10);
  if (rango.desde && f < rango.desde) return false;
  if (rango.hasta && f > rango.hasta) return false;
  return true;
}

function periodoLabel(rango?: Rango): string | null {
  if (!rango || (!rango.desde && !rango.hasta)) return null;
  if (rango.desde && rango.hasta) return `${isoToBO(rango.desde)} a ${isoToBO(rango.hasta)}`;
  if (rango.desde) return `desde ${isoToBO(rango.desde)}`;
  return `hasta ${isoToBO(rango.hasta!)}`;
}

function metaPeriodo(rango: Rango | undefined, count: number): { label: string; value: string }[] {
  const m: { label: string; value: string }[] = [];
  const p = periodoLabel(rango);
  if (p) m.push({ label: 'Periodo', value: p });
  m.push({ label: 'Filas', value: String(count) });
  return m;
}

const sufijo = (r?: Rango) =>
  (r && (r.desde || r.hasta)) ? `_${r.desde || 'inicio'}_a_${r.hasta || 'fin'}` : `_${hoyISO()}`;

// Nombre apto para archivo: "Juan Pérez" → "juan_perez".
const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x';

// ── Helper PDF (misma estética que los reportes existentes, vía window.print) ──
function triggerPDF(
  title: string,
  metaItems: { label: string; value: string }[],
  headers: string[],
  rows: (string | number)[][],
  totalLabel: string,
  totalValue: string,
): void {
  const metaHtml = metaItems.map(m => `<div><strong>${m.label}:</strong> ${m.value}</div>`).join('');
  const headHtml = headers.map((h, i) => `<th${i >= headers.length - 1 ? ' class="right"' : ''}>${h}</th>`).join('');
  const bodyHtml = rows.map(r =>
    `<tr>${r.map((c, i) => `<td${i >= r.length - 1 ? ' class="right"' : ''}>${c}</td>`).join('')}</tr>`,
  ).join('');

  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; }
      h1 { color: #1e40af; margin: 0 0 4px 0; }
      .subtitle { color: #555; font-size: 13px; margin-bottom: 18px; }
      .meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: #444; margin-bottom: 18px; }
      .meta div { background: #f3f4f6; padding: 6px 10px; border-radius: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #1e40af; color: white; padding: 10px 8px; text-align: left; }
      th.right, td.right { text-align: right; }
      td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) td { background: #f9fafb; }
      .total-general { margin-top: 18px; padding: 14px 16px; background: #1e40af; color: white; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
      .total-general strong { font-size: 16px; }
      .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; color: #999; font-size: 10px; text-align: center; }
      @media print { @page { margin: 1cm; } body { padding: 0; } }
    </style></head><body>
      <h1>${title}</h1>
      <div class="subtitle">Santa Cruz Computer - Reporte por voz</div>
      <div class="meta">${metaHtml}<div><strong>Generado:</strong> ${new Date().toLocaleString('es-BO')}</div></div>
      <table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>
      <div class="total-general"><span>${totalLabel}</span><strong>${totalValue}</strong></div>
      <div class="footer">Documento generado automáticamente desde el sistema</div>
    </body></html>
  `;
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) throw new Error('Permite las ventanas emergentes para descargar el PDF.');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

// ── 3. Generadores de reportes ───────────────────────────────────────────────

async function reporteAlmacen(formato: 'excel' | 'pdf') {
  const productos = await productosAPI.getAll();
  if (productos.length === 0) throw new Error('No hay productos para el reporte de almacén.');
  const totalUnidades = productos.reduce((s, p) => s + (p.stock ?? 0), 0);
  const valor = productos.reduce((s, p) => s + parseFloat(String(p.precio_venta ?? p.price)) * (p.stock ?? 0), 0);

  if (formato === 'excel') {
    const headers = ['Producto', 'Marca', 'Modelo', 'Categoría', 'P. Venta (Bs)', 'Stock', 'Stock Mín.', 'Disponibilidad'];
    const rows: (string | number)[][] = productos.map(p => [
      p.name, p.marca ?? '-', p.modelo ?? '-', p.categoria_nombre ?? '-',
      Number(parseFloat(String(p.precio_venta ?? p.price)).toFixed(2)),
      p.stock ?? 0, p.stock_minimo, p.is_low_stock ? 'Stock Bajo' : 'Disponible',
    ]);
    rows.push(['', '', '', '', '', '', 'TOTAL UNIDADES', totalUnidades]);
    rows.push(['', '', '', '', '', '', 'VALOR (Bs)', Number(valor.toFixed(2))]);
    exportToExcel({ filename: `reporte_almacen_${hoyISO()}`, sheetName: 'Almacén', headers, rows });
  } else {
    const headers = ['Producto', 'Marca/Modelo', 'Categoría', 'P. Venta', 'Stock', 'Estado'];
    const rows = productos.map(p => [
      p.name, [p.marca, p.modelo].filter(Boolean).join(' / ') || '-', p.categoria_nombre ?? '-',
      `Bs ${parseFloat(String(p.precio_venta ?? p.price)).toFixed(2)}`, String(p.stock ?? 0),
      p.is_low_stock ? 'Stock Bajo' : 'Disponible',
    ]);
    triggerPDF('Reporte de Almacén',
      [{ label: 'Total productos', value: String(productos.length) }],
      headers, rows, `VALOR INVENTARIO: ${totalUnidades} unidades`, `Bs ${valor.toFixed(2)}`);
  }
}

async function reporteEntradas(formato: 'excel' | 'pdf', rango?: Rango) {
  const compras = (await comprasAPI.getAll()).filter(c => enRango(c.fecha_compra, rango));
  const rowsBase: { compra: number; fecha: string; proveedor: string; producto: string; cantidad: number }[] = [];
  compras.forEach(c => (c.detalles ?? []).forEach(d => rowsBase.push({
    compra: c.id, fecha: c.fecha_compra, proveedor: c.proveedor_nombre,
    producto: d.producto_nombre, cantidad: d.cantidad,
  })));
  if (rowsBase.length === 0) throw new Error('No hay entradas de stock en el periodo indicado.');
  const total = rowsBase.reduce((s, r) => s + r.cantidad, 0);
  const headers = ['# Compra', 'Fecha', 'Proveedor', 'Producto', 'Cantidad'];

  if (formato === 'excel') {
    const rows: (string | number)[][] = rowsBase.map(r => [`#${r.compra}`, fechaBO(r.fecha), r.proveedor, r.producto, r.cantidad]);
    exportToExcel({
      filename: `reporte_entrada_stock${sufijo(rango)}`, sheetName: 'Entrada Stock', headers, rows,
      totalRow: ['', '', '', 'TOTAL UNIDADES INGRESADAS', total],
    });
  } else {
    const rows = rowsBase.map(r => [`#${r.compra}`, fechaBO(r.fecha), r.proveedor, r.producto, `+${r.cantidad}`]);
    triggerPDF('Reporte de Entrada de Stock', metaPeriodo(rango, rowsBase.length),
      headers, rows, 'TOTAL UNIDADES INGRESADAS', `+${total}`);
  }
}

async function reporteSalidas(formato: 'excel' | 'pdf', rango?: Rango) {
  const ventas = (await ventasAPI.getAll()).filter(v => enRango(v.fecha, rango));
  const rowsBase: { venta: number; fecha: string; cliente: string; producto: string; cantidad: number }[] = [];
  ventas.forEach(v => (v.detalles ?? []).forEach(d => rowsBase.push({
    venta: v.id, fecha: v.fecha, cliente: v.cliente_name || 'Consumidor Final',
    producto: d.producto_name || `Producto #${d.producto}`, cantidad: d.cantidad,
  })));
  if (rowsBase.length === 0) throw new Error('No hay salidas de stock en el periodo indicado.');
  const total = rowsBase.reduce((s, r) => s + r.cantidad, 0);
  const headers = ['# Venta', 'Fecha', 'Cliente', 'Producto', 'Cantidad'];

  if (formato === 'excel') {
    const rows: (string | number)[][] = rowsBase.map(r => [`#${r.venta}`, fechaBO(r.fecha), r.cliente, r.producto, r.cantidad]);
    exportToExcel({
      filename: `reporte_salida_stock${sufijo(rango)}`, sheetName: 'Salida Stock', headers, rows,
      totalRow: ['', '', '', 'TOTAL UNIDADES VENDIDAS', total],
    });
  } else {
    const rows = rowsBase.map(r => [`#${r.venta}`, fechaBO(r.fecha), r.cliente, r.producto, `-${r.cantidad}`]);
    triggerPDF('Reporte de Salida de Stock', metaPeriodo(rango, rowsBase.length),
      headers, rows, 'TOTAL UNIDADES VENDIDAS', `-${total}`);
  }
}

async function reporteVentas(formato: 'excel' | 'pdf', rango?: Rango) {
  const ventas = (await ventasAPI.getAll()).filter(v => enRango(v.fecha, rango));
  if (ventas.length === 0) throw new Error('No hay ventas en el periodo indicado.');
  const total = ventas.reduce((s, v) => s + parseFloat(String(v.total ?? 0)), 0);
  const headers = ['# Venta', 'Fecha', 'Cliente', 'Estado', 'Total (Bs)'];
  const estadoLabel = (s: string) => (s === 'completed' ? 'Completada' : s === 'pending' ? 'Pendiente' : s);

  if (formato === 'excel') {
    const rows: (string | number)[][] = ventas.map(v => [
      `#${v.id}`, fechaBO(v.fecha), v.cliente_name || 'Consumidor Final',
      estadoLabel(v.status), Number(parseFloat(String(v.total ?? 0)).toFixed(2)),
    ]);
    exportToExcel({
      filename: `reporte_ventas${sufijo(rango)}`, sheetName: 'Ventas', headers, rows,
      totalRow: ['', '', '', 'TOTAL (Bs)', Number(total.toFixed(2))],
    });
  } else {
    const rows = ventas.map(v => [
      `#${v.id}`, fechaBO(v.fecha), v.cliente_name || 'Consumidor Final',
      estadoLabel(v.status), `Bs ${parseFloat(String(v.total ?? 0)).toFixed(2)}`,
    ]);
    triggerPDF('Reporte de Ventas', metaPeriodo(rango, ventas.length),
      headers, rows, 'TOTAL VENDIDO', `Bs ${total.toFixed(2)}`);
  }
}

async function reporteCompras(formato: 'excel' | 'pdf', rango?: Rango) {
  const compras = (await comprasAPI.getAll()).filter(c => enRango(c.fecha_compra, rango));
  const rowsBase: { compra: number; proveedor: string; fecha: string; producto: string; cantidad: number; costo: number }[] = [];
  compras.forEach(c => (c.detalles ?? []).forEach(d => rowsBase.push({
    compra: c.id, proveedor: c.proveedor_nombre, fecha: c.fecha_compra,
    producto: d.producto_nombre, cantidad: d.cantidad, costo: Number(d.costo_unitario),
  })));
  if (rowsBase.length === 0) throw new Error('No hay compras a proveedores en el periodo indicado.');
  const total = rowsBase.reduce((s, r) => s + r.cantidad * r.costo, 0);
  const headers = ['# Compra', 'Proveedor', 'Fecha', 'Producto', 'Cantidad', 'Costo Unit. (Bs)', 'Subtotal (Bs)'];

  if (formato === 'excel') {
    const rows: (string | number)[][] = rowsBase.map(r => [
      `#${r.compra}`, r.proveedor, fechaBO(r.fecha), r.producto, r.cantidad,
      Number(r.costo.toFixed(2)), Number((r.cantidad * r.costo).toFixed(2)),
    ]);
    exportToExcel({
      filename: `reporte_compras${sufijo(rango)}`, sheetName: 'Compras', headers, rows,
      totalRow: ['', '', '', '', '', 'TOTAL GENERAL', Number(total.toFixed(2))],
    });
  } else {
    const rows = rowsBase.map(r => [
      `#${r.compra}`, r.proveedor, fechaBO(r.fecha), r.producto, String(r.cantidad),
      `Bs ${r.costo.toFixed(2)}`, `Bs ${(r.cantidad * r.costo).toFixed(2)}`,
    ]);
    triggerPDF('Reporte de Compras a Proveedores', metaPeriodo(rango, rowsBase.length),
      headers, rows, 'TOTAL GENERAL', `Bs ${total.toFixed(2)}`);
  }
}

// ── Rankings (Etapa 2) ────────────────────────────────────────────────────────

async function topVendidos(formato: 'excel' | 'pdf', rango?: Rango) {
  const ventas = (await ventasAPI.getAll()).filter(v => enRango(v.fecha, rango));
  const map = new Map<string, { cant: number; ingreso: number }>();
  ventas.forEach(v => (v.detalles ?? []).forEach(d => {
    const k = d.producto_name || `Producto #${d.producto}`;
    const e = map.get(k) || { cant: 0, ingreso: 0 };
    e.cant += d.cantidad; e.ingreso += Number(d.subtotal ?? 0);
    map.set(k, e);
  }));
  const arr = [...map.entries()].sort((a, b) => b[1].cant - a[1].cant);
  if (arr.length === 0) throw new Error('No hay ventas en el periodo para armar el ranking.');
  const totalU = arr.reduce((s, [, e]) => s + e.cant, 0);
  const headers = ['#', 'Producto', 'Unidades vendidas', 'Ingreso (Bs)'];

  if (formato === 'excel') {
    const rows: (string | number)[][] = arr.map(([k, e], i) => [i + 1, k, e.cant, Number(e.ingreso.toFixed(2))]);
    exportToExcel({
      filename: `top_productos_vendidos${sufijo(rango)}`, sheetName: 'Más vendidos', headers, rows,
      totalRow: ['', '', 'TOTAL UNIDADES', totalU],
    });
  } else {
    const rows = arr.map(([k, e], i) => [String(i + 1), k, String(e.cant), `Bs ${e.ingreso.toFixed(2)}`]);
    triggerPDF('Productos más vendidos', metaPeriodo(rango, arr.length),
      headers, rows, 'TOTAL UNIDADES VENDIDAS', String(totalU));
  }
}

async function topComprados(formato: 'excel' | 'pdf', rango?: Rango) {
  const compras = (await comprasAPI.getAll()).filter(c => enRango(c.fecha_compra, rango));
  const map = new Map<string, { cant: number; costo: number }>();
  compras.forEach(c => (c.detalles ?? []).forEach(d => {
    const k = d.producto_nombre || `Producto #${d.producto}`;
    const e = map.get(k) || { cant: 0, costo: 0 };
    e.cant += d.cantidad; e.costo += d.cantidad * Number(d.costo_unitario);
    map.set(k, e);
  }));
  const arr = [...map.entries()].sort((a, b) => b[1].cant - a[1].cant);
  if (arr.length === 0) throw new Error('No hay compras en el periodo para armar el ranking.');
  const totalU = arr.reduce((s, [, e]) => s + e.cant, 0);
  const headers = ['#', 'Producto', 'Unidades compradas', 'Costo (Bs)'];

  if (formato === 'excel') {
    const rows: (string | number)[][] = arr.map(([k, e], i) => [i + 1, k, e.cant, Number(e.costo.toFixed(2))]);
    exportToExcel({
      filename: `top_productos_comprados${sufijo(rango)}`, sheetName: 'Más comprados', headers, rows,
      totalRow: ['', '', 'TOTAL UNIDADES', totalU],
    });
  } else {
    const rows = arr.map(([k, e], i) => [String(i + 1), k, String(e.cant), `Bs ${e.costo.toFixed(2)}`]);
    triggerPDF('Productos más comprados', metaPeriodo(rango, arr.length),
      headers, rows, 'TOTAL UNIDADES COMPRADAS', String(totalU));
  }
}

async function topClientes(formato: 'excel' | 'pdf', rango?: Rango) {
  const ventas = (await ventasAPI.getAll()).filter(v => enRango(v.fecha, rango));
  const map = new Map<string, { n: number; total: number }>();
  ventas.forEach(v => {
    const k = v.cliente_name || 'Consumidor Final';
    const e = map.get(k) || { n: 0, total: 0 };
    e.n += 1; e.total += Number(v.total ?? 0);
    map.set(k, e);
  });
  const arr = [...map.entries()].sort((a, b) => (b[1].n - a[1].n) || (b[1].total - a[1].total));
  if (arr.length === 0) throw new Error('No hay ventas en el periodo para armar el ranking.');
  const totalGastado = arr.reduce((s, [, e]) => s + e.total, 0);
  const headers = ['#', 'Cliente', '# Compras', 'Total gastado (Bs)'];

  if (formato === 'excel') {
    const rows: (string | number)[][] = arr.map(([k, e], i) => [i + 1, k, e.n, Number(e.total.toFixed(2))]);
    exportToExcel({
      filename: `top_clientes${sufijo(rango)}`, sheetName: 'Clientes frecuentes', headers, rows,
      totalRow: ['', '', 'TOTAL (Bs)', Number(totalGastado.toFixed(2))],
    });
  } else {
    const rows = arr.map(([k, e], i) => [String(i + 1), k, String(e.n), `Bs ${e.total.toFixed(2)}`]);
    triggerPDF('Clientes más frecuentes', metaPeriodo(rango, arr.length),
      headers, rows, 'TOTAL GASTADO', `Bs ${totalGastado.toFixed(2)}`);
  }
}

async function topProveedores(formato: 'excel' | 'pdf', rango?: Rango) {
  const compras = (await comprasAPI.getAll()).filter(c => enRango(c.fecha_compra, rango));
  const map = new Map<string, { n: number; monto: number }>();
  compras.forEach(c => {
    const k = c.proveedor_nombre || 'Proveedor';
    const e = map.get(k) || { n: 0, monto: 0 };
    e.n += 1; e.monto += Number(c.monto_total ?? 0);
    map.set(k, e);
  });
  const arr = [...map.entries()].sort((a, b) => (b[1].monto - a[1].monto) || (b[1].n - a[1].n));
  if (arr.length === 0) throw new Error('No hay compras en el periodo para armar el ranking.');
  const totalMonto = arr.reduce((s, [, e]) => s + e.monto, 0);
  const headers = ['#', 'Proveedor', '# Compras', 'Monto total (Bs)'];

  if (formato === 'excel') {
    const rows: (string | number)[][] = arr.map(([k, e], i) => [i + 1, k, e.n, Number(e.monto.toFixed(2))]);
    exportToExcel({
      filename: `top_proveedores${sufijo(rango)}`, sheetName: 'Proveedores top', headers, rows,
      totalRow: ['', '', 'TOTAL (Bs)', Number(totalMonto.toFixed(2))],
    });
  } else {
    const rows = arr.map(([k, e], i) => [String(i + 1), k, String(e.n), `Bs ${e.monto.toFixed(2)}`]);
    triggerPDF('Proveedores con más compras', metaPeriodo(rango, arr.length),
      headers, rows, 'MONTO TOTAL COMPRADO', `Bs ${totalMonto.toFixed(2)}`);
  }
}

// ── Etapa 3: facturas por cliente y compras por proveedor ─────────────────────

// Coincidencias de nombre (tolerante a la voz). Devuelve 0, 1 o varios para que
// el asistente muestre una lista de desambiguación cuando haga falta.
export function buscarClientes(nombre: string, clientes: ApiCliente[]): ApiCliente[] {
  const q = norm(nombre).trim();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  return clientes
    .map(c => {
      const nom = norm(`${c.nombre} ${c.apellido}`).trim();
      const full = `${nom} ${norm(c.usuario_login ?? '')}`;
      const score = nom === q ? 100 : full.includes(q) ? 80 : tokens.every(tk => full.includes(tk)) ? 60 : 0;
      return { c, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.c);
}

export function buscarProveedores(nombre: string, provs: ApiProveedor[]): ApiProveedor[] {
  const q = norm(nombre).trim();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  return provs
    .map(p => {
      const emp = norm(p.nombre_empresa).trim();
      const full = `${emp} ${norm(p.razon_social ?? '')} ${norm(p.contacto_nombre ?? '')}`;
      const score = emp === q ? 100 : full.includes(q) ? 80 : tokens.every(tk => full.includes(tk)) ? 60 : 0;
      return { p, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.p);
}

async function _facturasCliente(cliente: ApiCliente, formato: 'excel' | 'pdf', rango?: Rango) {
  const nombre = `${cliente.nombre} ${cliente.apellido}`.trim();
  const ventas = (await ventasAPI.getByCliente(cliente.id)).filter(v => enRango(v.fecha, rango));
  if (ventas.length === 0) throw new Error(`No hay facturas de ${nombre} en el periodo indicado.`);
  const total = ventas.reduce((s, v) => s + parseFloat(String(v.total ?? 0)), 0);
  const headers = ['# Factura', 'Fecha', 'Estado', 'Total (Bs)'];
  const estadoLabel = (s: string) => (s === 'completed' ? 'Completada' : s === 'pending' ? 'Pendiente' : s);

  if (formato === 'excel') {
    const rows: (string | number)[][] = ventas.map(v => [
      `#${v.id}`, fechaBO(v.fecha), estadoLabel(v.status), Number(parseFloat(String(v.total ?? 0)).toFixed(2)),
    ]);
    exportToExcel({
      filename: `facturas_${slug(nombre)}${sufijo(rango)}`, sheetName: 'Facturas', headers, rows,
      totalRow: ['', '', 'TOTAL (Bs)', Number(total.toFixed(2))],
    });
  } else {
    const rows = ventas.map(v => [
      `#${v.id}`, fechaBO(v.fecha), estadoLabel(v.status), `Bs ${parseFloat(String(v.total ?? 0)).toFixed(2)}`,
    ]);
    triggerPDF(`Facturas de ${nombre}`,
      [{ label: 'Cliente', value: nombre }, ...metaPeriodo(rango, ventas.length)],
      headers, rows, 'TOTAL FACTURADO', `Bs ${total.toFixed(2)}`);
  }
}

export async function generarFacturasCliente(cliente: ApiCliente, formato: VozFormato, rango?: Rango): Promise<void> {
  if (formato === 'ambos') {
    await _facturasCliente(cliente, 'excel', rango);
    await _facturasCliente(cliente, 'pdf', rango);
    return;
  }
  return _facturasCliente(cliente, formato, rango);
}

async function _comprasProveedor(prov: ApiProveedor, formato: 'excel' | 'pdf', rango?: Rango) {
  const nombre = prov.nombre_empresa;
  const compras = (await comprasAPI.getAll())
    .filter(c => c.proveedor === prov.id && enRango(c.fecha_compra, rango));
  const rowsBase: { compra: number; fecha: string; producto: string; cantidad: number; costo: number }[] = [];
  compras.forEach(c => (c.detalles ?? []).forEach(d => rowsBase.push({
    compra: c.id, fecha: c.fecha_compra, producto: d.producto_nombre,
    cantidad: d.cantidad, costo: Number(d.costo_unitario),
  })));
  if (rowsBase.length === 0) throw new Error(`No hay compras al proveedor ${nombre} en el periodo indicado.`);
  const total = rowsBase.reduce((s, r) => s + r.cantidad * r.costo, 0);
  const headers = ['# Compra', 'Fecha', 'Producto', 'Cantidad', 'Costo Unit. (Bs)', 'Subtotal (Bs)'];

  if (formato === 'excel') {
    const rows: (string | number)[][] = rowsBase.map(r => [
      `#${r.compra}`, fechaBO(r.fecha), r.producto, r.cantidad,
      Number(r.costo.toFixed(2)), Number((r.cantidad * r.costo).toFixed(2)),
    ]);
    exportToExcel({
      filename: `compras_${slug(nombre)}${sufijo(rango)}`, sheetName: 'Compras', headers, rows,
      totalRow: ['', '', '', '', 'TOTAL (Bs)', Number(total.toFixed(2))],
    });
  } else {
    const rows = rowsBase.map(r => [
      `#${r.compra}`, fechaBO(r.fecha), r.producto, String(r.cantidad),
      `Bs ${r.costo.toFixed(2)}`, `Bs ${(r.cantidad * r.costo).toFixed(2)}`,
    ]);
    triggerPDF(`Compras al proveedor ${nombre}`,
      [{ label: 'Proveedor', value: nombre }, ...metaPeriodo(rango, rowsBase.length)],
      headers, rows, 'TOTAL COMPRADO', `Bs ${total.toFixed(2)}`);
  }
}

export async function generarComprasProveedor(prov: ApiProveedor, formato: VozFormato, rango?: Rango): Promise<void> {
  if (formato === 'ambos') {
    await _comprasProveedor(prov, 'excel', rango);
    await _comprasProveedor(prov, 'pdf', rango);
    return;
  }
  return _comprasProveedor(prov, formato, rango);
}

// ── 4. Despachador ─────────────────────────────────────────────────────────────
function generarUno(reporte: VozReporte, formato: 'excel' | 'pdf', rango?: Rango): Promise<void> {
  switch (reporte) {
    case 'almacen':         return reporteAlmacen(formato);
    case 'entradas':        return reporteEntradas(formato, rango);
    case 'salidas':         return reporteSalidas(formato, rango);
    case 'ventas':          return reporteVentas(formato, rango);
    case 'compras':         return reporteCompras(formato, rango);
    case 'top_vendidos':    return topVendidos(formato, rango);
    case 'top_comprados':   return topComprados(formato, rango);
    case 'top_clientes':    return topClientes(formato, rango);
    case 'top_proveedores': return topProveedores(formato, rango);
    default:
      // 'factura' | 'facturas_cliente' | 'compras_proveedor' se manejan aparte
      // (necesitan resolver número/cliente/proveedor en el asistente).
      return Promise.reject(new Error('Este reporte se genera desde el asistente.'));
  }
}

export async function generarReporte(reporte: VozReporte, formato: VozFormato, rango?: Rango): Promise<void> {
  if (formato === 'ambos') {
    await generarUno(reporte, 'excel', rango);
    await generarUno(reporte, 'pdf', rango);
    return;
  }
  return generarUno(reporte, formato, rango);
}
