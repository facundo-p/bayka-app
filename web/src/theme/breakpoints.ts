import ESCALA from './breakpoints.json';

/**
 * Escala de breakpoints en px (#359). Los números viven en un JSON para que la
 * auditoría responsive, que corre en Node, lea los mismos. El porqué de cada
 * escalón está en el bloque Layout de `theme.css`.
 */
export const ANCHO_BP: Readonly<typeof ESCALA.ancho> = ESCALA.ancho;
export const ALTO_BP: Readonly<typeof ESCALA.alto> = ESCALA.alto;
