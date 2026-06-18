/**
 * vozReportes.ts - Generación de reportes disparada por voz
 *
 * Centraliza, para el asistente de voz (solo admin):
 *  1. parseIntent(texto): reglas locales que detectan reporte + formato sin IA.
 *  2. generarReporte(reporte, formato): trae los datos con las APIs existentes
 *     y exporta en Excel (reusa exportToExcel) o PDF (helper local estilo print).
 *
 * Reportes soportados: almacen | entradas | salidas | ventas | compras.
 * Funciona desde cualquier pantalla porque trae sus propios datos.
 */
import { productosAPI, ventasAPI, comprasAPI } from '../services/api';
import type { VozReporte, VozIntencion } from '../services/api';
import { exportToExcel } from './exportExcel';

export const REPORTE_LABEL: Record<VozReporte, string> = {
  almacen:  'Almacén (stock)',
  entradas: 'Entradas de stock',
  salidas:  'Salidas de stock',
  ventas:   'Ventas',
  compras:  'Compras a proveedores',
};

// ── 1. Reglas locales (sin IA) ───────────────────────────────────────────────
export function parseIntent(textoRaw: string): VozIntencion | null {
  const t = textoRaw.toLowerCase();

  // Formato: pdf si lo menciona; excel por defecto
  const formato: 'excel' | 'pdf' = /\bpdf\b/.test(t) ? 'pdf' : 'excel';

  let reporte: VozReporte | null = null;
  // El orden importa: "compras"/"ventas" antes que entradas/salidas genéricas
  if (/\b(compra|compras|proveedor|proveedores)\b/.test(t)) reporte = 'compras';
  else if (/\b(venta|ventas|vendido|vendidas?)\b/.test(t)) reporte = 'ventas';
  else if (/\b(entrada|entradas|ingreso|ingresos)\b/.test(t)) reporte = 'entradas';
  else if (/\b(salida|salidas|egreso|egresos)\b/.test(t)) reporte = 'salidas';
  else if (/\b(almac[eé]n|inventario|stock|producto|productos|existencias?)\b/.test(t)) reporte = 'almacen';

  if (!reporte) return null;
  return { reporte, formato };
}

const hoyISO = () => new Date().toISOString().split('T')[0];
const fechaBO = (f: string) => new Date(f).toLocaleDateString('es-BO');

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

// ── 2. Generadores de reportes ───────────────────────────────────────────────

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

async function reporteEntradas(formato: 'excel' | 'pdf') {
  const compras = await comprasAPI.getAll();
  const rowsBase: { compra: number; fecha: string; proveedor: string; producto: string; cantidad: number }[] = [];
  compras.forEach(c => (c.detalles ?? []).forEach(d => rowsBase.push({
    compra: c.id, fecha: c.fecha_compra, proveedor: c.proveedor_nombre,
    producto: d.producto_nombre, cantidad: d.cantidad,
  })));
  if (rowsBase.length === 0) throw new Error('No hay entradas de stock registradas.');
  const total = rowsBase.reduce((s, r) => s + r.cantidad, 0);
  const headers = ['# Compra', 'Fecha', 'Proveedor', 'Producto', 'Cantidad'];

  if (formato === 'excel') {
    const rows: (string | number)[][] = rowsBase.map(r => [`#${r.compra}`, fechaBO(r.fecha), r.proveedor, r.producto, r.cantidad]);
    exportToExcel({
      filename: `reporte_entrada_stock_${hoyISO()}`, sheetName: 'Entrada Stock', headers, rows,
      totalRow: ['', '', '', 'TOTAL UNIDADES INGRESADAS', total],
    });
  } else {
    const rows = rowsBase.map(r => [`#${r.compra}`, fechaBO(r.fecha), r.proveedor, r.producto, `+${r.cantidad}`]);
    triggerPDF('Reporte de Entrada de Stock',
      [{ label: 'Total líneas', value: String(rowsBase.length) }],
      headers, rows, 'TOTAL UNIDADES INGRESADAS', `+${total}`);
  }
}

async function reporteSalidas(formato: 'excel' | 'pdf') {
  const ventas = await ventasAPI.getAll();
  const rowsBase: { venta: number; fecha: string; cliente: string; producto: string; cantidad: number }[] = [];
  ventas.forEach(v => (v.detalles ?? []).forEach(d => rowsBase.push({
    venta: v.id, fecha: v.fecha, cliente: v.cliente_name || 'Consumidor Final',
    producto: d.producto_name || `Producto #${d.producto}`, cantidad: d.cantidad,
  })));
  if (rowsBase.length === 0) throw new Error('No hay salidas de stock registradas.');
  const total = rowsBase.reduce((s, r) => s + r.cantidad, 0);
  const headers = ['# Venta', 'Fecha', 'Cliente', 'Producto', 'Cantidad'];

  if (formato === 'excel') {
    const rows: (string | number)[][] = rowsBase.map(r => [`#${r.venta}`, fechaBO(r.fecha), r.cliente, r.producto, r.cantidad]);
    exportToExcel({
      filename: `reporte_salida_stock_${hoyISO()}`, sheetName: 'Salida Stock', headers, rows,
      totalRow: ['', '', '', 'TOTAL UNIDADES VENDIDAS', total],
    });
  } else {
    const rows = rowsBase.map(r => [`#${r.venta}`, fechaBO(r.fecha), r.cliente, r.producto, `-${r.cantidad}`]);
    triggerPDF('Reporte de Salida de Stock',
      [{ label: 'Total líneas', value: String(rowsBase.length) }],
      headers, rows, 'TOTAL UNIDADES VENDIDAS', `-${total}`);
  }
}

async function reporteVentas(formato: 'excel' | 'pdf') {
  const ventas = await ventasAPI.getAll();
  if (ventas.length === 0) throw new Error('No hay ventas registradas.');
  const total = ventas.reduce((s, v) => s + parseFloat(String(v.total ?? 0)), 0);
  const headers = ['# Venta', 'Fecha', 'Cliente', 'Estado', 'Total (Bs)'];
  const estadoLabel = (s: string) => (s === 'completed' ? 'Completada' : s === 'pending' ? 'Pendiente' : s);

  if (formato === 'excel') {
    const rows: (string | number)[][] = ventas.map(v => [
      `#${v.id}`, fechaBO(v.fecha), v.cliente_name || 'Consumidor Final',
      estadoLabel(v.status), Number(parseFloat(String(v.total ?? 0)).toFixed(2)),
    ]);
    exportToExcel({
      filename: `reporte_ventas_${hoyISO()}`, sheetName: 'Ventas', headers, rows,
      totalRow: ['', '', '', 'TOTAL (Bs)', Number(total.toFixed(2))],
    });
  } else {
    const rows = ventas.map(v => [
      `#${v.id}`, fechaBO(v.fecha), v.cliente_name || 'Consumidor Final',
      estadoLabel(v.status), `Bs ${parseFloat(String(v.total ?? 0)).toFixed(2)}`,
    ]);
    triggerPDF('Reporte de Ventas',
      [{ label: 'Total ventas', value: String(ventas.length) }],
      headers, rows, 'TOTAL VENDIDO', `Bs ${total.toFixed(2)}`);
  }
}

async function reporteCompras(formato: 'excel' | 'pdf') {
  const compras = await comprasAPI.getAll();
  const rowsBase: { compra: number; proveedor: string; fecha: string; producto: string; cantidad: number; costo: number }[] = [];
  compras.forEach(c => (c.detalles ?? []).forEach(d => rowsBase.push({
    compra: c.id, proveedor: c.proveedor_nombre, fecha: c.fecha_compra,
    producto: d.producto_nombre, cantidad: d.cantidad, costo: Number(d.costo_unitario),
  })));
  if (rowsBase.length === 0) throw new Error('No hay compras a proveedores registradas.');
  const total = rowsBase.reduce((s, r) => s + r.cantidad * r.costo, 0);
  const headers = ['# Compra', 'Proveedor', 'Fecha', 'Producto', 'Cantidad', 'Costo Unit. (Bs)', 'Subtotal (Bs)'];

  if (formato === 'excel') {
    const rows: (string | number)[][] = rowsBase.map(r => [
      `#${r.compra}`, r.proveedor, fechaBO(r.fecha), r.producto, r.cantidad,
      Number(r.costo.toFixed(2)), Number((r.cantidad * r.costo).toFixed(2)),
    ]);
    exportToExcel({
      filename: `reporte_compras_${hoyISO()}`, sheetName: 'Compras', headers, rows,
      totalRow: ['', '', '', '', '', 'TOTAL GENERAL', Number(total.toFixed(2))],
    });
  } else {
    const rows = rowsBase.map(r => [
      `#${r.compra}`, r.proveedor, fechaBO(r.fecha), r.producto, String(r.cantidad),
      `Bs ${r.costo.toFixed(2)}`, `Bs ${(r.cantidad * r.costo).toFixed(2)}`,
    ]);
    triggerPDF('Reporte de Compras a Proveedores',
      [{ label: 'Total líneas', value: String(rowsBase.length) }],
      headers, rows, 'TOTAL GENERAL', `Bs ${total.toFixed(2)}`);
  }
}

export async function generarReporte(reporte: VozReporte, formato: 'excel' | 'pdf'): Promise<void> {
  switch (reporte) {
    case 'almacen':  return reporteAlmacen(formato);
    case 'entradas': return reporteEntradas(formato);
    case 'salidas':  return reporteSalidas(formato);
    case 'ventas':   return reporteVentas(formato);
    case 'compras':  return reporteCompras(formato);
  }
}
