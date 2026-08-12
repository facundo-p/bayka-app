/*
 * Genera un CSV de exportación de plantación, compatible con Excel, sin
 * dependencias externas (evita el paquete `xlsx` por sus CVEs). Un CSV con BOM
 * UTF-8 abre nativo en Excel respetando acentos/ñ.
 *
 * Espeja el esquema de mobile (ExportService, D-18-08): 9 columnas en orden
 * exacto, comillado RFC 4180 y las mismas normalizaciones (idGlobal/idParcial
 * null → celda vacía, parcela null → vacía, especie null → "N/N").
 *
 * `construirCsvExportacion` es PURA (mismas filas → misma cadena, sin BOM): así
 * es testeable con aserciones sobre el encabezado. El BOM se antepone recién en
 * la descarga (`descargarCsvExportacion`), no en el builder.
 */
import { ESPECIE_NO_RESUELTA, type FilaExportacion } from '../queries/exportacionQueries';
import { descargarTexto, nombreArchivoDescarga } from './descargas';

/** MIME del CSV (UTF-8). */
export const TIPO_MIME_CSV = 'text/csv;charset=utf-8';
const EXTENSION_CSV = 'csv';

/** BOM UTF-8: sin él, Excel (Windows) lee el CSV como ANSI y rompe acentos/ñ. */
const BOM_UTF8 = '\uFEFF';

/** Encabezado de las 9 columnas, en el orden canónico (D-18-08). */
const ENCABEZADO_CSV = 'ID Global,ID Parcial,Zona,Plantación,Parcela,Grupo,SubID,Periodo,Especie';

/**
 * Comilla el campo si contiene coma, comilla o salto de línea (RFC 4180): lo
 * envuelve en comillas dobles y duplica las comillas internas. null/undefined
 * → cadena vacía.
 */
function campoCsv(valor: string | number | null | undefined): string {
  const texto = valor == null ? '' : String(valor);
  if (texto.includes(',') || texto.includes('"') || texto.includes('\n')) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/** Fila CSV de 9 campos (orden D-18-08): parcela null → vacía, especie null → "N/N". */
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

/**
 * CSV completo: encabezado + una fila por árbol. Función pura, sin BOM (el BOM
 * lo agrega la descarga).
 */
export function construirCsvExportacion(filas: FilaExportacion[]): string {
  return [ENCABEZADO_CSV, ...filas.map(filaACsv)].join('\n');
}

/** Nombre de archivo descriptivo: `export-<lugar>-<periodo>.csv`. */
export function nombreArchivoCsv(lugar: string, periodo: string): string {
  return nombreArchivoDescarga('export', lugar, periodo, EXTENSION_CSV);
}

/**
 * Arma el CSV, le antepone el BOM UTF-8 y dispara la descarga. El BOM se agrega
 * acá (no en `construirCsvExportacion`) para mantener el builder puro.
 */
export function descargarCsvExportacion(
  filas: FilaExportacion[],
  lugar: string,
  periodo: string,
): void {
  const contenido = BOM_UTF8 + construirCsvExportacion(filas);
  descargarTexto(contenido, nombreArchivoCsv(lugar, periodo), TIPO_MIME_CSV);
}
