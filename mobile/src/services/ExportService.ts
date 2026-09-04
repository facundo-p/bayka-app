/**
 * ExportService — genera CSV/Excel/KML de datos de plantación y los comparte vía share sheet nativo.
 * Orden de columnas: ID Global, ID Parcial, Zona, Plantación, Parcela, Grupo, SubID, Periodo, Especie.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';
import { getExportRows, getKmlExportRows, type ExportRow } from '../queries/exportQueries';
import { pullSpeciesFromServer } from './sync/preSteps';
import { syncLog } from '../utils/syncLogger';
import { buildKml } from './kml/kmlGenerator';

// BOM UTF-8 (EF BB BF): sin él, Excel (Windows) interpreta el CSV como ANSI y rompe acentos/ñ;
// el .xlsx no lo necesita (ya embebe la codificación).
const UTF8_BOM = String.fromCharCode(0xFEFF);

// Especie no resuelta (especieId null o huérfano): se muestra en vez de perder la fila, para que
// el problema quede visible.
const ESPECIE_NO_RESUELTA = 'N/N';

/** Refresca el catálogo de especies antes del export; best-effort — si falla, sigue con el catálogo local (el LEFT JOIN evita perder árboles, a lo sumo salen como "N/N"). */
async function refreshSpeciesCatalogBeforeExport(): Promise<void> {
  try {
    await pullSpeciesFromServer();
  } catch (e) {
    syncLog.error('Export: refresco de especies falló, se usa catálogo local:', e);
  }
}

/** Escribe el BOM UTF-8 a nivel de bytes cuando hay `TextEncoder` (detección de encoding sin ambigüedad en Excel); si no, cae a `encoding: 'utf8'`. */
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

// ─── Header constant ─────────────────────────────────────────────────────────

export const CSV_HEADER =
  'ID Global,ID Parcial,Zona,Plantación,Parcela,Grupo,SubID,Periodo,Especie\n';

// ─── CSV helpers ──────────────────────────────────────────────────────────────

/** Encierra el valor en comillas si tiene coma/comilla/salto de línea (RFC 4180). */
function csvField(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Fila CSV en el orden del header (especieNombre null → 'N/N'; parcelaNombre es obligatoria). */
function rowToCSV(r: ExportRow): string {
  return [
    csvField(r.globalId),
    csvField(r.idParcial),
    csvField(r.lugar),
    csvField(r.plantacionLugar),
    csvField(r.parcelaNombre),
    csvField(r.grupoNombre),
    csvField(r.subId),
    csvField(r.periodo),
    csvField(r.especieNombre ?? ESPECIE_NO_RESUELTA),
  ].join(',');
}

/** Igual a rowToCSV pero como objeto, para SheetJS. */
export function rowToExcel(r: ExportRow) {
  return {
    'ID Global': r.globalId,
    'ID Parcial': r.idParcial,
    'Zona': r.lugar,
    'Plantación': r.plantacionLugar,
    'Parcela': r.parcelaNombre,
    'Grupo': r.grupoNombre,
    'SubID': r.subId,
    'Periodo': r.periodo,
    'Especie': r.especieNombre ?? ESPECIE_NO_RESUELTA,
  };
}

// ─── exportToCSV ─────────────────────────────────────────────────────────────

/** Genera el CSV de la plantación y lo comparte. */
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

// Tope de ancho de columna: evita que un valor larguísimo genere una columna inusable, + padding visual.
const EXCEL_ANCHO_MAX = 100;
const EXCEL_ANCHO_PADDING = 2;

/** Ancho por columna = mayor largo entre header y valores, topeado en EXCEL_ANCHO_MAX+padding; las columnas salen de las claves de `rowToExcel` para no desincronizarse del esquema. */
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

/** Genera el Excel (vía SheetJS) de la plantación y lo comparte. */
export async function exportToExcel(plantacionId: string, plantationName: string): Promise<void> {
  await refreshSpeciesCatalogBeforeExport();
  const rows = await getExportRows(plantacionId);
  const sheetData = rows.map(rowToExcel);

  const ws = XLSX.utils.json_to_sheet(sheetData);
  ws['!cols'] = excelColumnWidths(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantacion');

  // type: 'base64' — Node Buffer no está disponible en React Native.
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  const file = new File(Paths.cache, `${plantationName}_export.xlsx`);
  file.write(base64, { encoding: 'base64' });

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Exportar Excel',
  });
}

// ─── exportToKML ──────────────────────────────────────────────────────────────

/** Exporta puntos GPS como KML (placemarks por especie, folders parcela → grupo); sin árboles con GPS, lanza error. */
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
