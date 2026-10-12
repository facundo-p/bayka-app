/*
 * Peso aproximado del PDF del reporte, con los mismos conteos que la estimación
 * de hojas: el modal lo muestra antes de leer los árboles.
 */
import { BYTES } from '../../lib/formato';
import { FILAS_POR_HOJA, type EstimacionReporte } from './planReporte';

/** Bytes de cada parte del PDF. */
export const PESO_PDF = {
  /** Fuentes embebidas, logo y estructura del documento. */
  base: 40 * BYTES.kb,
  /**
   * 25 fotos reales de SS26-1 en staging, reducidas como el PDF (480 px,
   * calidad 0,75, recorte al centro), promediaron 67 KB, entre 29 y 101.
   */
  porFoto: 67 * BYTES.kb,
  /** Texto y filetes de una hoja llena del listado. */
  porHojaListado: 6 * BYTES.kb,
} as const;

/** En bytes. Las tarjetas pesan por su foto: el texto de su hoja es poco al lado. */
export function estimarPeso({ tarjetas, filasListado }: EstimacionReporte): number {
  const hojasListado = Math.ceil(filasListado / FILAS_POR_HOJA);
  return PESO_PDF.base + tarjetas * PESO_PDF.porFoto + hojasListado * PESO_PDF.porHojaListado;
}
