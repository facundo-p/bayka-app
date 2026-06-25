import { COLOR_GRAFICO_NN, colorEspeciePorIndice } from '../../theme/chartColors';
import { ESPECIE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';

/**
 * Color del punto que precede a la especie en el listado de árboles.
 *
 * - Sin código (null) o N/N → ámbar de alerta (COLOR_GRAFICO_NN).
 * - Resto → color estable de la paleta categórica derivado del código.
 *
 * El índice de paleta se obtiene hasheando el código (suma de char codes
 * módulo la cantidad de colores). Es determinístico —el mismo código siempre
 * cae en el mismo color— y barato; no busca distribución criptográfica, solo
 * un mapeo reproducible código→color sin depender del orden de la lista.
 */
export function colorPuntoEspecie(codigo: string | null): string {
  if (!codigo || codigo === ESPECIE_SIN_IDENTIFICAR) return COLOR_GRAFICO_NN;
  const hash = [...codigo].reduce((suma, caracter) => suma + caracter.charCodeAt(0), 0);
  return colorEspeciePorIndice(hash);
}
