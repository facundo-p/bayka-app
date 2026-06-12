/*
 * Paleta JS para gráficos Recharts.
 *
 * Excepción documentada a "cero hex fuera del tema": Recharts recibe los
 * colores como props de JS y no puede leer custom properties de CSS, así que
 * estos hex duplican valores de theme.css. Origen: theme.css — si cambia un
 * color de marca hay que actualizarlo acá también.
 */

/** Azules y verdes oliva de marca alternados, para series categóricas. */
export const COLORES_GRAFICOS = [
  '#0a3760', // --color-primary
  '#99b95b', // --color-secondary
  '#1a5a8a', // --color-primary-light
  '#7a9a42', // --color-plantation-dark
  '#3b7db5', // --color-primary-accent
  '#b3cf7e', // --color-plantation-light
  '#0e4573', // --color-primary-medium
  '#6b8f3c', // --color-plantation-header-bg
  '#a3c4db', // --color-primary-bg-muted
  '#a8c465', // --color-plantation-accent
];

/** Amarillo de especies N/N (--color-yellow). */
export const COLOR_GRAFICO_NN = '#ffca28';

/** Gris para el segmento "Otras" de la torta (--color-text-muted). */
export const COLOR_GRAFICO_OTRAS = '#94a3b8';

/** Gris claro de la grilla de los gráficos (--color-border). */
export const COLOR_GRAFICO_GRILLA = '#e2e8f0';

/** Azul primario de las barras por parcela. */
export const COLOR_GRAFICO_BARRAS = COLORES_GRAFICOS[0];

/** Verde oliva de la línea de registros por mes. */
export const COLOR_GRAFICO_LINEA = COLORES_GRAFICOS[1];
