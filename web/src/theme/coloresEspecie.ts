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

/** Especie habilitada en una plantación con su lugar fijo en la paleta (#845). */
export type LugarDeEspecie = { codigo: string; lugarColor: number | null };

/** Los 8 de los gráficos y los 4 extra (#756): con 12 especies o menos no se repite ninguno. */
export const PALETA_ESPECIES = [...COLORES_GRAFICOS, ...COLORES_GRAFICOS_EXTRA] as const;

/**
 * Respaldo para cuando no se pueden leer los lugares de la plantación: el color
 * sale de hashear el código, así que dos especies pueden coincidir. No depende
 * de qué especies muestre la vista, así que es el mismo en todas.
 */
export function colorEspeciePorCodigo(codigo: string | null): string {
  if (!codigo || esSinIdentificar(codigo)) return COLOR_GRAFICO_NN;
  const hash = [...codigo].reduce((suma, caracter) => suma + caracter.charCodeAt(0), 0);
  return colorEspeciePorIndice(hash);
}

function colorDeHabilitada({ codigo, lugarColor }: LugarDeEspecie): string {
  if (lugarColor === null) return colorEspeciePorCodigo(codigo);
  return PALETA_ESPECIES[lugarColor % PALETA_ESPECIES.length];
}

/**
 * Colores de las especies de UNA plantación (#845): cada especie habilitada
 * guarda un lugar fijo en la paleta, que no cambia al habilitar o quitar otras.
 * Así la misma especie se ve igual en el dashboard, el mapa, Datos, el KML, la
 * ficha y el informe.
 *
 * - Sin código o N/N → ámbar de "sin identificar".
 * - Habilitada sin lugar legible (la base todavía no tiene la columna) → hash.
 * - Código que no está habilitado → gris: no le roba el color a una que sí.
 */
export function coloresDeEspecies(especies: readonly LugarDeEspecie[]): ColorEspecie {
  const colores = new Map(especies.map((especie) => [especie.codigo, colorDeHabilitada(especie)]));
  return (codigo) => {
    if (codigo === null || esSinIdentificar(codigo)) return COLOR_GRAFICO_NN;
    return colores.get(codigo) ?? COLOR_GRAFICO_OTRAS;
  };
}
