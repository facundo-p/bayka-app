/*
 * CSV de exportación de plantación, sin dependencias externas (evita `xlsx` por sus CVEs).
 * Espeja el esquema de mobile (ExportService): 9 columnas, comillado RFC 4180.
 * `construirCsvExportacion` es PURA (testeable); el BOM se agrega recién en la descarga.
 */
import { ESPECIE_NO_RESUELTA, type FilaExportacion } from '../queries/exportacionQueries';
import { descargarTexto, nombreArchivoDescarga } from './descargas';

export const TIPO_MIME_CSV = 'text/csv;charset=utf-8';
const EXTENSION_CSV = 'csv';

/** BOM UTF-8: sin él, Excel (Windows) lee el CSV como ANSI y rompe acentos/ñ. */
const BOM_UTF8 = '\uFEFF';

const ENCABEZADO_CSV = 'ID Global,ID Parcial,Zona,Plantación,Parcela,Grupo,SubID,Periodo,Especie';

/** RFC 4180: comilla el campo si tiene coma/comilla/salto de línea, duplicando comillas internas; null/undefined → vacío. */
function campoCsv(valor: string | number | null | undefined): string {
  const texto = valor == null ? '' : String(valor);
  if (texto.includes(',') || texto.includes('"') || texto.includes('\n')) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/** Fila CSV de 9 campos: parcela null → vacía, especie null → "N/N". */
function filaACsv(fila: FilaExportacion): string {
  return [
    campoCsv(fila.idGlobal),
    campoCsv(fila.idParcial),
    campoCsv(fila.zona),
    campoCsv(fila.plantacion),
    campoCsv(fila.parcela ?? ''),
    campoCsv(fila.grupo),
    campoCsv(fila.subId),
    campoCsv(fila.periodo),
    campoCsv(fila.especie ?? ESPECIE_NO_RESUELTA),
  ].join(',');
}

/** CSV completo: encabezado + una fila por árbol. Función pura, sin BOM (lo agrega la descarga). */
export function construirCsvExportacion(filas: FilaExportacion[]): string {
  return [ENCABEZADO_CSV, ...filas.map(filaACsv)].join('\n');
}

/** Nombre de archivo descriptivo: `export-<lugar>-<periodo>.csv`. */
export function nombreArchivoCsv(lugar: string, periodo: string): string {
  return nombreArchivoDescarga('export', lugar, periodo, EXTENSION_CSV);
}

/** Arma el CSV, antepone el BOM UTF-8 y dispara la descarga (el builder se mantiene puro). */
export function descargarCsvExportacion(
  filas: FilaExportacion[],
  lugar: string,
  periodo: string,
): void {
  const contenido = BOM_UTF8 + construirCsvExportacion(filas);
  descargarTexto(contenido, nombreArchivoCsv(lugar, periodo), TIPO_MIME_CSV);
}
