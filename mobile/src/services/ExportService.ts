/**
 * ExportService — generates CSV and Excel files from plantation export data
 * and shares them via the native share sheet.
 *
 * Covers: EXPO-01 (CSV), EXPO-02 (Excel), EXPO-PARC-01 (Parcela column),
 *         EXPO-PARC-02 (Parcela value = parcela.nombre).
 *
 * 9-column order (D-18-08):
 *   ID Global, ID Parcial, Zona, Plantación, Parcela, Grupo, SubID, Periodo, Especie
 *
 * CRITICAL (Pitfall 4): Always use type: 'base64' in XLSX.write — Node Buffer
 * is not available in React Native.
 * CRITICAL (Pitfall 5): Write to Paths.cache only.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';
import { getExportRows, getKmlExportRows, type ExportRow } from '../queries/exportQueries';
import { pullSpeciesFromServer } from './sync/preSteps';
import { syncLog } from '../utils/syncLogger';
import { buildKml } from './kml/kmlGenerator';

// BOM UTF-8 (EF BB BF): sin él, Excel (Windows) interpreta el CSV como ANSI y
// rompe los acentos/ñ. El .xlsx no lo necesita (embebe la codificación). #87.
const UTF8_BOM = String.fromCharCode(0xFEFF);

// Etiqueta para árboles cuya especie no se pudo resolver (especieId null o
// huérfano). Se muestra en la planilla en vez de perder la fila, así el problema
// queda visible.
const ESPECIE_NO_RESUELTA = 'N/N';

/**
 * Refresca el catálogo de especies desde el server antes de generar el export.
 * Best-effort: si no hay red o falla, seguimos con el catálogo local — el LEFT
 * JOIN garantiza que ningún árbol se pierda (a lo sumo sale como "N/N"). Cubre
 * el caso de especies del server que aún no bajaron a este dispositivo.
 */
async function refreshSpeciesCatalogBeforeExport(): Promise<void> {
  try {
    await pullSpeciesFromServer();
  } catch (e) {
    syncLog.error('Export: refresco de especies falló, se usa catálogo local:', e);
  }
}

/**
 * Escribe el CSV con BOM UTF-8 garantizado a nivel de bytes (EF BB BF + cuerpo
 * UTF-8) cuando `TextEncoder` está disponible — así Excel detecta la codificación
 * sin ambigüedad. Si no lo está, cae al string con `encoding: 'utf8'` (también
 * correcto, pero menos explícito).
 */
function writeCsvWithBom(file: File, csvBody: string): void {
  if (typeof TextEncoder !== 'undefined') {
    const body = new TextEncoder().encode(csvBody);
    const bytes = new Uint8Array(body.length + 3);
    bytes[0] = 0xef;
    bytes[1] = 0xbb;
    bytes[2] = 0xbf;
    bytes.set(body, 3);
    file.write(bytes);
    return;
  }
  file.write(UTF8_BOM + csvBody, { encoding: 'utf8' });
}

// ─── Header constant (D-18-08 — exact order) ────────────────────────────────

const CSV_HEADER =
  'ID Global,ID Parcial,Zona,Plantación,Parcela,Grupo,SubID,Periodo,Especie\n';

// ─── CSV helpers ──────────────────────────────────────────────────────────────

/**
 * Wraps a field value in double quotes if it contains a comma, quote, or newline.
 * This satisfies RFC 4180 CSV quoting requirements.
 */
function csvField(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a single CSV row from an ExportRow (9 columns, D-18-08 order).
 * Normalizes `parcelaNombre: null` → '' (D-18-10) y `especieNombre: null` → 'N/N'.
 */
function rowToCSV(r: ExportRow): string {
  return [
    csvField(r.globalId),
    csvField(r.idParcial),
    csvField(r.lugar),
    csvField(r.plantacionLugar),
    csvField(r.parcelaNombre ?? ''),
    csvField(r.grupoNombre),
    csvField(r.subId),
    csvField(r.periodo),
    csvField(r.especieNombre ?? ESPECIE_NO_RESUELTA),
  ].join(',');
}

/**
 * Build an Excel sheetData entry (9 keys, D-18-08 order).
 * Normalizes `parcelaNombre: null` → '' (D-18-10) y `especieNombre: null` → 'N/N'.
 */
function rowToExcel(r: ExportRow) {
  return {
    'ID Global': r.globalId,
    'ID Parcial': r.idParcial,
    'Zona': r.lugar,
    'Plantación': r.plantacionLugar,
    'Parcela': r.parcelaNombre ?? '',
    'Grupo': r.grupoNombre,
    'SubID': r.subId,
    'Periodo': r.periodo,
    'Especie': r.especieNombre ?? ESPECIE_NO_RESUELTA,
  };
}

// ─── exportToCSV ─────────────────────────────────────────────────────────────

/**
 * EXPO-01
 * Fetches all export rows, builds a CSV string, writes to cache, and shares.
 */
export async function exportToCSV(plantacionId: string, plantationName: string): Promise<void> {
  await refreshSpeciesCatalogBeforeExport();
  const rows = await getExportRows(plantacionId);
  const csvBody = CSV_HEADER + rows.map(rowToCSV).join('\n');

  const file = new File(Paths.cache, `${plantationName}_export.csv`);
  writeCsvWithBom(file, csvBody);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Exportar CSV',
  });
}

// ─── exportToExcel ────────────────────────────────────────────────────────────

// Ajuste de ancho de columnas (#54): tope para que un valor larguísimo no
// produzca una columna inusable, más un pequeño respiro visual.
const EXCEL_ANCHO_MAX = 100;
const EXCEL_ANCHO_PADDING = 2;

/**
 * Anchos de columna ajustados al contenido (#54): por columna, el mayor largo
 * entre el encabezado y todos los valores (como string), con tope de
 * EXCEL_ANCHO_MAX + padding. Las columnas se derivan de las claves de la
 * primera fila (`rowToExcel`), no de una lista aparte, para no desincronizarse
 * del esquema D-18-08. Sin filas no hay hoja que ensanchar → [].
 */
function excelColumnWidths(sheetData: Record<string, unknown>[]): { wch: number }[] {
  if (sheetData.length === 0) return [];
  return Object.keys(sheetData[0]).map((header) => {
    let longest = header.length;
    for (const row of sheetData) {
      const len = String(row[header] ?? '').length;
      if (len > longest) longest = len;
    }
    return { wch: Math.min(longest, EXCEL_ANCHO_MAX) + EXCEL_ANCHO_PADDING };
  });
}

/**
 * EXPO-02
 * Fetches all export rows, builds an Excel workbook via SheetJS,
 * writes as base64 to cache, and shares.
 */
export async function exportToExcel(plantacionId: string, plantationName: string): Promise<void> {
  await refreshSpeciesCatalogBeforeExport();
  const rows = await getExportRows(plantacionId);
  const sheetData = rows.map(rowToExcel);

  const ws = XLSX.utils.json_to_sheet(sheetData);
  ws['!cols'] = excelColumnWidths(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantacion');

  // CRITICAL: use type: 'base64' — Node Buffer not available in React Native
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  // CRITICAL: write to Paths.cache only
  const file = new File(Paths.cache, `${plantationName}_export.xlsx`);
  file.write(base64, { encoding: 'base64' });

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Exportar Excel',
  });
}

// ─── exportToKML ──────────────────────────────────────────────────────────────

/**
 * Exporta los puntos GPS de la plantación como KML (placemarks coloreados por
 * especie, folders parcela → grupo). Solo árboles con coordenadas; sin puntos
 * lanza un error con mensaje claro para el usuario.
 */
export async function exportToKML(plantacionId: string, plantationName: string): Promise<void> {
  const rows = await getKmlExportRows(plantacionId);
  if (rows.length === 0) {
    throw new Error('La plantación no tiene árboles con punto GPS para exportar.');
  }
  const kml = buildKml(plantationName, rows);

  const file = new File(Paths.cache, `${plantationName}_puntos.kml`);
  file.write(kml);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.google-earth.kml+xml',
    dialogTitle: 'Exportar KML',
  });
}
