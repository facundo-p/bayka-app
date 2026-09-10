/*
 * Paleta JS para gráficos Recharts y Leaflet: esas libs reciben color por JS, no
 * por custom properties, así que la paleta categórica vive solo acá. Los hex que
 * coinciden con un token de theme.css lo nombran: si cambia uno, cambia el otro.
 */

/* Azules/verdes oliva de marca, en orden que maximiza el contraste entre
 * vecinos (alterna tono y luminancia). */
export const COLORES_GRAFICOS = [
  '#0a3760', // azul de marca (--color-primary)
  '#99b95b', // oliva de marca (--color-secondary)
  '#3b7db5', // azul medio (--color-primary-accent)
  '#6b8f3c', // oliva oscuro (--color-plantation-dark)
  '#1a5a8a', // azul medio-oscuro
  '#b3cf7e', // oliva claro (--color-plantation-light)
  '#0e4573', // azul oscuro (--color-primary-medium)
  '#a8c465', // oliva claro-medio
];

/** Ámbar de especies N/N — "Sin identificar" (--color-warn-dot). */
export const COLOR_GRAFICO_NN = '#e0a83b';

/** Gris de DATO para "Otras": categoría real, no texto deshabilitado. */
export const COLOR_GRAFICO_OTRAS = '#64748b';

/** Hairline cálido de la grilla de los gráficos (--color-border). */
export const COLOR_GRAFICO_GRILLA = '#e7e1d4';

/** Azul primario de las barras por parcela. */
export const COLOR_GRAFICO_BARRAS = COLORES_GRAFICOS[0];

/** Oliva de marca de la línea de registros por mes. */
export const COLOR_GRAFICO_LINEA = COLORES_GRAFICOS[1];

/** Color de especie por índice, estable y cíclico. */
export function colorEspeciePorIndice(indice: number): string {
  return COLORES_GRAFICOS[indice % COLORES_GRAFICOS.length];
}
