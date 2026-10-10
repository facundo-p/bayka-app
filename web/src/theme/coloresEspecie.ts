import { esSinIdentificar } from '../queries/especiesConstantes';
import {
  COLOR_GRAFICO_NN,
  COLOR_GRAFICO_OTRAS,
  COLORES_GRAFICOS,
  COLORES_GRAFICOS_EXTRA,
  colorEspeciePorIndice,
} from './chartColors';

/** Color de una especie por su código; null = sin especie. */
export type ColorEspecie = (codigo: string | null) => string;

/** Los 8 de los gráficos y los 4 extra (#756): con 12 especies o menos no se repite ninguno. */
export const PALETA_ESPECIES = [...COLORES_GRAFICOS, ...COLORES_GRAFICOS_EXTRA] as const;

/** Códigos identificados, sin repetidos y ordenados: el índice de cada uno es su color. */
function ordenarCodigos(codigos: readonly string[]): string[] {
  return [...new Set(codigos.filter((codigo) => !esSinIdentificar(codigo)))].sort();
}

/**
 * Colores de las especies de UNA plantación (#777): cada código toma el color de
 * su posición en el catálogo de la plantación ordenado por código, así que dos
 * especies de la misma plantación no comparten color (hasta 12) y la misma
 * especie se ve igual en el dashboard, el mapa, Datos, el KML y la ficha.
 *
 * - Sin código o N/N → ámbar de "sin identificar".
 * - Código fuera del catálogo → gris: no le roba el color a una especie habilitada.
 */
export function coloresDeEspecies(codigos: readonly string[]): ColorEspecie {
  const colores = new Map(
    ordenarCodigos(codigos).map((codigo, indice) => [
      codigo,
      PALETA_ESPECIES[indice % PALETA_ESPECIES.length],
    ]),
  );
  return (codigo) => {
    if (codigo === null || esSinIdentificar(codigo)) return COLOR_GRAFICO_NN;
    return colores.get(codigo) ?? COLOR_GRAFICO_OTRAS;
  };
}

/**
 * Color de una especie fuera de una plantación (pantallas del catálogo de
 * Especies), donde no hay un conjunto de especies contra el cual distinguirla.
 * Sale de hashear el código, así que dos especies pueden coincidir.
 */
export function colorEspeciePorCodigo(codigo: string | null): string {
  if (!codigo || esSinIdentificar(codigo)) return COLOR_GRAFICO_NN;
  const hash = [...codigo].reduce((suma, caracter) => suma + caracter.charCodeAt(0), 0);
  return colorEspeciePorIndice(hash);
}
