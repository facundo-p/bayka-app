/**
 * ExportService — generates CSV and Excel files from plantation export data
 * and shares them via the native share sheet.
 *
 * Covers: EXPO-01 (CSV), EXPO-02 (Excel)
 *
 * CRITICAL (Pitfall 4): Always use type: 'base64' in XLSX.write — Node Buffer
 * is not available in React Native.
 * CRITICAL (Pitfall 5): Write to Paths.cache only.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';
import { getExportRows } from '../queries/exportQueries';

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

// ─── exportToCSV ─────────────────────────────────────────────────────────────

/**
 * EXPO-01
 * Fetches all export rows, builds a CSV string, writes to cache, and shares.
 */
export async function exportToCSV(plantacionId: string, plantationName: string): Promise<void> {
  const rows = await getExportRows(plantacionId);

  const header = 'ID Global,ID Parcial,Zona,SubGrupo,SubID,Periodo,Especie\n';
  const body = rows
    .map(
      (r) =>
        [
          csvField(r.globalId),
          csvField(r.idParcial),
          csvField(r.lugar),
          csvField(r.subgrupoNombre),
          csvField(r.subId),
          csvField(r.periodo),
          csvField(r.especieNombre),
        ].join(',')
    )
    .join('\n');

  const csv = header + body;
  const file = new File(Paths.cache, `${plantationName}_export.csv`);
  file.write(csv, { encoding: 'utf8' });

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Exportar CSV',
  });
}

// ─── exportToExcel ────────────────────────────────────────────────────────────

/**
 * EXPO-02
 * Fetches all export rows, builds an Excel workbook via SheetJS,
 * writes as base64 to cache, and shares.
 */
export async function exportToExcel(plantacionId: string, plantationName: string): Promise<void> {
  const rows = await getExportRows(plantacionId);

  const sheetData = rows.map((r) => ({
    'ID Global': r.globalId,
    'ID Parcial': r.idParcial,
    'Zona': r.lugar,
    'SubGrupo': r.subgrupoNombre,
    'SubID': r.subId,
    'Periodo': r.periodo,
    'Especie': r.especieNombre,
  }));

  const ws = XLSX.utils.json_to_sheet(sheetData);
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
