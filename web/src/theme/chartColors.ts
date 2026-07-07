/*
 * Paleta JS para gráficos Recharts y puntos de mapa (Leaflet).
 *
 * Excepción documentada a "cero hex fuera del tema": Recharts/Leaflet reciben los
 * colores como props/JS y no pueden leer custom properties de CSS, así que estos
 * hex duplican los tokens --chart-* de theme.css. Origen: theme.css — si cambia
 * un color de marca hay que actualizarlo en ambos lugares.
 */

/*
 * Azules y verdes oliva de marca para series categóricas (espejo de --chart-1..8).
 * Orden elegido para MAXIMIZAR el contraste entre vecinos: se alterna azul oscuro
 * → verde → azul medio → verde oscuro, de modo que dos segmentos contiguos siempre
 * difieren en tono Y luminancia y se distinguen de un vistazo.
 */
export const COLORES_GRAFICOS = [
  '#0a3760', // --chart-1 (azul de marca)
  '#99b95b', // --chart-2 (oliva de marca)
  '#3b7db5', // --chart-3 (azul medio)
  '#6b8f3c', // --chart-4 (oliva oscuro)
  '#1a5a8a', // --chart-5 (azul medio-oscuro)
  '#b3cf7e', // --chart-6 (oliva claro)
  '#0e4573', // --chart-7 (azul oscuro)
  '#a8c465', // --chart-8 (oliva claro-medio)
];

/** Ámbar de especies N/N — "Sin identificar" (--chart-nn). */
export const COLOR_GRAFICO_NN = '#e0a83b';

/** Gris de DATO para el segmento "Otras" (--color-data-neutral): es una
 *  categoría real, no un color de texto deshabilitado. */
export const COLOR_GRAFICO_OTRAS = '#64748b';

/** Hairline cálido de la grilla de los gráficos (--color-border). */
export const COLOR_GRAFICO_GRILLA = '#e7e1d4';

/** Azul primario de las barras por parcela (--chart-1). */
export const COLOR_GRAFICO_BARRAS = COLORES_GRAFICOS[0];

/** Oliva de marca de la línea de registros por mes (--chart-2). */
export const COLOR_GRAFICO_LINEA = COLORES_GRAFICOS[1];

/**
 * Color de especie por índice, estable y cíclico, para Recharts y los puntos
 * del mapa. Mantiene el mismo hex que --chart-* del CSS.
 */
export function colorEspeciePorIndice(indice: number): string {
  return COLORES_GRAFICOS[indice % COLORES_GRAFICOS.length];
}
