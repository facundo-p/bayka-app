/*
 * XLSX nativo de exportación con `write-excel-file` (liviana, evita `xlsx`@npm por sus CVEs).
 * Espeja el esquema de mobile: mismas 9 columnas y normalizaciones que el CSV; a diferencia
 * de este, ID Global/ID Parcial viajan tipados como número. `COLUMNAS_XLSX` es un mapeo puro
 * fila→celdas (testeable); la descarga arma el Blob y delega en `descargarBlob`.
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

/** Las 9 columnas en el orden canónico: parcela null → vacía, especie null → "N/N". */
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

// Ancho de columna con tope (#54): evita que un valor larguísimo genere una columna inusable, + padding visual.
const ANCHO_MAX_COLUMNA = 100;
const ANCHO_PADDING = 2;

/** Largo en caracteres del valor de una celda (null → 0). */
function largoCelda(celda: Cell): number {
  const valor = celda != null && typeof celda === 'object' && 'value' in celda ? celda.value : celda;
  return valor == null ? 0 : String(valor).length;
}

/** Ancho por columna = mayor largo entre encabezado y celdas, topeado (#54); misma regla que mobile. */
export function columnasConAncho(filas: FilaExportacion[]): Column<FilaExportacion>[] {
  return COLUMNAS_XLSX.map((columna) => {
    let largoMaximo = largoCelda(columna.header);
    filas.forEach((fila, indice) => {
      const largo = largoCelda(columna.cell(fila, indice));
      if (largo > largoMaximo) largoMaximo = largo;
    });
    return { ...columna, width: Math.min(largoMaximo, ANCHO_MAX_COLUMNA) + ANCHO_PADDING };
  });
}

/** Arma el XLSX y dispara la descarga; la librería se importa dinámicamente para no sumarla al bundle inicial. */
export async function descargarXlsxExportacion(
  filas: FilaExportacion[],
  lugar: string,
  periodo: string,
): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const blob = await writeXlsxFile(filas, {
    columns: columnasConAncho(filas),
    sheet: NOMBRE_HOJA,
  }).toBlob();
  descargarBlob(blob, nombreArchivoXlsx(lugar, periodo));
}
