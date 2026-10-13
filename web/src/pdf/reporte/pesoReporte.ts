/*
 * Peso aproximado del PDF del reporte, con los mismos conteos que la estimación
 * de hojas: el modal lo muestra antes de leer los árboles.
 */
import { BYTES } from '../../lib/formato';
import type { EstimacionReporte } from './planReporte';

/**
 * Bytes de cada parte del PDF. Base y hoja salen de reportes reales de 2 y de
 * 226 hojas: el peso crece en línea recta con las hojas.
 */
export const PESO_PDF = {
  /** Fuentes y logo embebidos, y la estructura del documento. */
  base: 22 * BYTES.kb,
  /** El texto de la hoja: el logo se embebe una sola vez para todas. */
  porHoja: 6 * BYTES.kb,
  /**
   * 25 fotos reales de SS26-1 en staging, reducidas como el PDF (480 px,
   * calidad 0,75, recorte al centro), promediaron 67 KB, entre 29 y 101.
   */
  porFoto: 67 * BYTES.kb,
} as const;

/** En bytes. */
export function estimarPeso({ tarjetas, hojas }: EstimacionReporte): number {
  return PESO_PDF.base + hojas * PESO_PDF.porHoja + tarjetas * PESO_PDF.porFoto;
}
