/*
 * Peso aproximado del PDF del reporte, con los mismos conteos que la estimación
 * de hojas: el modal lo muestra antes de leer los árboles. Con el texto entero,
 * como las hojas, es un piso.
 */
import { BYTES } from '../../lib/formato';
import type { EstimacionReporte } from './planReporte';

/**
 * Bytes de cada parte del PDF. Base y hoja salen de reportes reales de 2 y de
 * 226 hojas: el peso crece en línea recta con las hojas.
 */
export const PESO_PDF = {
  /** Fuentes embebidas y estructura del documento. */
  base: 15 * BYTES.kb,
  /** El logo se embebe de nuevo en cada hoja (8,4 KB); el resto es el texto. */
  porHoja: 15 * BYTES.kb,
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
