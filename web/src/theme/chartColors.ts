/*
 * Paleta JS para gráficos Recharts.
 *
 * Excepción documentada a "cero hex fuera del tema": Recharts recibe los
 * colores como props de JS y no puede leer custom properties de CSS, así que
 * estos hex duplican valores de theme.css. Origen: theme.css — si cambia un
 * color de marca hay que actualizarlo acá también.
 */

/*
 * Azules y verdes oliva de marca para series categóricas.
 * Orden elegido para MAXIMIZAR el contraste entre vecinos: se alterna
 * azul oscuro → verde claro → azul medio → verde oscuro, de modo que dos
 * segmentos contiguos siempre difieren en tono Y luminancia y se distinguen
 * de un vistazo (no dos azules ni dos verdes seguidos).
 */
export const COLORES_GRAFICOS = [
  '#0a3760', // --color-primary (azul muy oscuro)
  '#b3cf7e', // --color-plantation-light (verde claro)
  '#3b7db5', // --color-primary-accent (azul medio)
  '#6b8f3c', // --color-plantation-header-bg (verde oscuro)
  '#a3c4db', // --color-primary-bg-muted (azul muy claro)
  '#7a9a42', // --color-plantation-dark (verde oscuro)
  '#1a5a8a', // --color-primary-light (azul medio-oscuro)
  '#a8c465', // --color-plantation-accent (verde claro-medio)
  '#0e4573', // --color-primary-medium (azul oscuro)
  '#99b95b', // --color-secondary (verde medio)
];

/** Amarillo de especies N/N (--color-yellow). */
export const COLOR_GRAFICO_NN = '#ffca28';

/** Gris de DATO para el segmento "Otras" (--color-data-neutral): es una
 *  categoría real, no un color de texto deshabilitado. */
export const COLOR_GRAFICO_OTRAS = '#64748b';

/** Gris claro de la grilla de los gráficos (--color-border). */
export const COLOR_GRAFICO_GRILLA = '#e2e8f0';

/** Azul primario de las barras por parcela. */
export const COLOR_GRAFICO_BARRAS = COLORES_GRAFICOS[0];

/** Verde oliva de la línea de registros por mes. */
export const COLOR_GRAFICO_LINEA = COLORES_GRAFICOS[1];
