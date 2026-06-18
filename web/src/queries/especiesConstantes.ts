/*
 * Constantes de dominio de especies, sin dependencias de red.
 *
 * Viven acá (y no en los módulos de queries) para que la lógica pura de
 * preparación de gráficos pueda importarlas sin arrastrar el cliente Supabase
 * y, con él, la exigencia de variables de entorno en los tests.
 */

/** Código del árbol sin especie identificada. */
export const ESPECIE_SIN_IDENTIFICAR = 'NN';

/** Nombre visible del segmento/grupo de árboles sin especie. */
export const NOMBRE_SIN_IDENTIFICAR = 'Sin identificar';
