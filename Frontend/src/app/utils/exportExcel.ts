/**
 * exportExcel.ts - Helper compartido para exportar reportes a Excel (.xlsx)
 *
 * Usa SheetJS (xlsx) para generar archivos Excel reales con:
 *  - Anchos de columna calculados automaticamente segun el contenido
 *  - Numeros formateados como numeros (no como texto)
 *  - Compatible con Excel en cualquier idioma sin necesidad de "sep=," ni BOM
 *  - Una sola llamada desde cualquier pagina
 */
import * as XLSX from 'xlsx';

export interface ExportToExcelOptions {
  /** Nombre del archivo SIN extension (la funcion agrega ".xlsx") */
  filename: string;
  /** Nombre de la hoja interna del libro. Default: "Reporte" */
  sheetName?: string;
  /** Encabezados de columnas */
  headers: string[];
  /** Filas de datos (una fila por sub-array) */
  rows: (string | number)[][];
  /** Fila opcional con el total, ej: ["", "", "TOTAL", 1000] */
  totalRow?: (string | number)[];
}

export function exportToExcel(opts: ExportToExcelOptions): void {
  const { filename, sheetName = 'Reporte', headers, rows, totalRow } = opts;

  const allRows: (string | number)[][] = [headers, ...rows];
  if (totalRow) allRows.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Auto-width: el ancho de cada columna se calcula con el contenido mas largo
  // de esa columna (encabezado + filas + total). Limitado a 60 para evitar
  // columnas gigantescas cuando hay textos muy largos.
  const colWidths = headers.map((header, i) => {
    let maxLen = String(header).length;
    for (const row of rows) {
      const cell = row[i];
      if (cell != null) {
        const len = String(cell).length;
        if (len > maxLen) maxLen = len;
      }
    }
    if (totalRow) {
      const cell = totalRow[i];
      if (cell != null) {
        const len = String(cell).length;
        if (len > maxLen) maxLen = len;
      }
    }
    return { wch: Math.min(maxLen + 2, 60) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
