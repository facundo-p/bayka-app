import { ESPECIE_SIN_IDENTIFICAR } from '../queries/especiesConstantes';
import { COLOR_GRAFICO_NN, colorEspeciePorIndice } from './chartColors';

/**
 * Color estable de una especie por su código. ÚNICO mapeo código→color de la
 * app: dashboard ("Por especie"), mapa y listado de Datos pintan la misma
 * especie con el mismo color, sin depender del orden/rango de la vista.
 *
 * - Sin código (null) o N/N → ámbar de "sin identificar" (COLOR_GRAFICO_NN).
 * - Resto → color de la paleta categórica derivado del código: el índice sale
 *   de hashear el código (suma de char codes módulo la cantidad de colores).
 *   Determinístico y barato; no busca distribución criptográfica, solo un
 *   mapeo reproducible código→color.
 */
export function colorEspeciePorCodigo(codigo: string | null): string {
  if (!codigo || codigo === ESPECIE_SIN_IDENTIFICAR) return COLOR_GRAFICO_NN;
  const hash = [...codigo].reduce((suma, caracter) => suma + caracter.charCodeAt(0), 0);
  return colorEspeciePorIndice(hash);
}
