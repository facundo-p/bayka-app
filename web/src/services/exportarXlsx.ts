/*
 * Genera un XLSX nativo de exportación de plantación con `write-excel-file`
 * (librería mantenida y liviana; se sigue evitando `xlsx`@npm por sus CVEs).
 *
 * Espeja el esquema canónico de mobile (D-18-08): mismas 9 columnas, mismo
 * orden y mismas normalizaciones que el CSV (`exportarCsv.ts`). La ventaja
 * real sobre el CSV: ID Global / ID Parcial viajan tipados como número.
 *
 * `COLUMNAS_XLSX` es un mapeo puro fila→celdas (testeable sin tocar la
 * librería); la descarga arma el Blob y delega en `descargarBlob`.
 */
import type { Cell, Column } from 'write-excel-file/browser';
import { ESPECIE_NO_RESUELTA, type FilaExportacion } from '../queries/exportacionQueries';
import { descargarBlob, nombreArchivoDescarga } from './descargas';

const EXTENSION_XLSX = 'xlsx';

/** Nombre de la hoja, igual que en mobile (ExportService). */
const NOMBRE_HOJA = 'Plantacion';

/** Celda numérica tipada; null → celda vacía (igual que el CSV). */
function celdaNumero(valor: number | null): Cell {
  return valor == null ? null : { value: valor, type: Number };
}

function celdaTexto(valor: string): Cell {
  return { value: valor, type: String };
}

/** Las 9 columnas en el orden canónico (D-18-08): parcela null → vacía,
 *  especie null → "N/N". */
export const COLUMNAS_XLSX: Column<FilaExportacion>[] = [
  { header: 'ID Global', cell: (fila) => celdaNumero(fila.idGlobal) },
  { header: 'ID Parcial', cell: (fila) => celdaNumero(fila.idParcial) },
  { header: 'Zona', cell: (fila) => celdaTexto(fila.zona) },
  { header: 'Plantación', cell: (fila) => celdaTexto(fila.plantacion) },
  { header: 'Parcela', cell: (fila) => celdaTexto(fila.parcela ?? '') },
  { header: 'Grupo', cell: (fila) => celdaTexto(fila.grupo) },
  { header: 'SubID', cell: (fila) => celdaTexto(fila.subId) },
  { header: 'Periodo', cell: (fila) => celdaTexto(fila.periodo) },
  { header: 'Especie', cell: (fila) => celdaTexto(fila.especie ?? ESPECIE_NO_RESUELTA) },
];

/** Nombre de archivo descriptivo: `export-<lugar>-<periodo>.xlsx`. */
export function nombreArchivoXlsx(lugar: string, periodo: string): string {
  return nombreArchivoDescarga('export', lugar, periodo, EXTENSION_XLSX);
}

/** Arma el XLSX (hoja "Plantacion") y dispara la descarga. La librería se
 *  importa dinámicamente para no sumarla al bundle inicial (~21 kB gzip):
 *  se descarga recién en la primera exportación. */
export async function descargarXlsxExportacion(
  filas: FilaExportacion[],
  lugar: string,
  periodo: string,
): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const blob = await writeXlsxFile(filas, { columns: COLUMNAS_XLSX, sheet: NOMBRE_HOJA }).toBlob();
  descargarBlob(blob, nombreArchivoXlsx(lugar, periodo));
}
