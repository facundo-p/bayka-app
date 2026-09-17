/**
 * Plantaciones que la sync global salteó enteras (#478): sin acceso o eliminadas en
 * el server. Antes solo se logueaban y el modal decía "completa" sin mencionarlas.
 */
import { esEliminada, esSinAcceso } from './types';
import type { PullResult } from './types';
import type { ResultadoDePlantacion } from './orchestrators';

/** Nombres (lugar) de cada grupo, en el orden de la corrida. */
export interface PlantacionesOmitidas {
  sinAcceso: string[];
  eliminadas: string[];
}

export const SIN_OMITIDAS: PlantacionesOmitidas = { sinAcceso: [], eliminadas: [] };

export function plantacionesOmitidas(resultados: ResultadoDePlantacion[]): PlantacionesOmitidas {
  const nombresSi = (predicado: (pull: PullResult) => boolean) =>
    resultados.filter((r) => r.pull && predicado(r.pull)).map((r) => r.plantationName);
  return { sinAcceso: nombresSi(esSinAcceso), eliminadas: nombresSi(esEliminada) };
}

export function hayOmitidas(omitidas: PlantacionesOmitidas): boolean {
  return omitidas.sinAcceso.length + omitidas.eliminadas.length > 0;
}
