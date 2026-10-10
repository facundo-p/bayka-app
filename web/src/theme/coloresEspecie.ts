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

function esCodigoIdentificado(codigo: string): boolean {
  return codigo !== '' && !esSinIdentificar(codigo);
}

/** Códigos identificados, sin repetidos y ordenados: el índice de cada uno es su color. */
function ordenarCodigos(codigos: readonly string[]): string[] {
  return [...new Set(codigos.filter(esCodigoIdentificado))].sort();
}

/**
 * Colores de las especies de UNA plantación (#777): cada código toma el color de
 * su posición en el catálogo de la plantación ordenado por código, así que dos
 * especies de la misma plantación no comparten color (hasta 12) y la misma
 * especie se ve igual en el dashboard, el mapa, Datos, el KML y la ficha.
 *
 * - Sin código o N/N → ámbar de "sin identificar".
 * - Código fuera del catálogo → gris: no le roba el color a una especie habilitada.
 * - Catálogo vacío (no se pudo leer o no hay especies habilitadas) → se usan los
 *   códigos `presentes` en la vista, con el mismo criterio, para no pintar todo igual.
 */
export function coloresDeEspecies(
  catalogo: readonly string[],
  presentes: readonly string[] = [],
): ColorEspecie {
  const ordenados = ordenarCodigos(catalogo);
  const codigos = ordenados.length > 0 ? ordenados : ordenarCodigos(presentes);
  const colores = new Map(
    codigos.map((codigo, indice) => [codigo, PALETA_ESPECIES[indice % PALETA_ESPECIES.length]]),
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
