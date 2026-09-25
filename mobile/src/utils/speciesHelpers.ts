import { notLike } from 'drizzle-orm';
import { species as speciesTable } from '../database/schema';
import { especieDelSubId } from './idGenerator';

/** Placeholder especie codigo embedded in a tree's subId when unresolved (N/N). */
export const UNKNOWN_SPECIES_CODE = 'NN';

/** Etiqueta de un árbol sin especie (N/N). */
export const NN_SPECIES_LABEL = 'N/N';

/** Etiqueta de un árbol con especie que no está en el catálogo local, o es una recuperada. */
const ETIQUETA_ESPECIE_FUERA_DE_CATALOGO = '??';

/**
 * Prefijo del codigo de una especie recreada por `limpiarHuerfanos` hasta que el pull del
 * catálogo le traiga el real. Sin `_` ni `%`: se filtra con LIKE.
 */
export const PREFIJO_ESPECIE_RECUPERADA = 'recuperada:';

/** Codigo de la especie recuperada; el id lo hace único. */
export const codigoDeEspecieRecuperada = (id: string) => `${PREFIJO_ESPECIE_RECUPERADA}${id}`;

export const esEspecieRecuperada = (codigo: string) => codigo.startsWith(PREFIJO_ESPECIE_RECUPERADA);

/** Condición SQL que deja afuera las especies recuperadas: no se ofrecen para elegir. */
export const soloEspeciesDelCatalogo = () =>
  notLike(speciesTable.codigo, `${PREFIJO_ESPECIE_RECUPERADA}%`);

/** El codigo si es de una especie del catálogo; null si falta o es de una recuperada. */
const codigoDelCatalogo = (codigo: string | null | undefined) =>
  codigo && !esEspecieRecuperada(codigo) ? codigo : null;

/** Codigo que va en un SubID: una especie recuperada sube como NN, igual que una sin resolver. */
export function codigoParaSubId(codigo: string | null | undefined): string {
  return codigoDelCatalogo(codigo) ?? UNKNOWN_SPECIES_CODE;
}

/** Display label/codigo for a tree whose especie is not yet resolved. */
export function getSpeciesCode(tree: {
  especieId?: string | null;
  especieCodigo?: string | null;
}): string {
  if (!tree.especieId) return NN_SPECIES_LABEL;
  return codigoDelCatalogo(tree.especieCodigo) ?? ETIQUETA_ESPECIE_FUERA_DE_CATALOGO;
}

/** Display name for a tree whose especie is not yet resolved. */
export function getSpeciesName(tree: {
  especieId?: string | null;
  especieNombre?: string | null;
}): string {
  if (!tree.especieId) return NN_SPECIES_LABEL;
  return tree.especieNombre ?? ETIQUETA_ESPECIE_FUERA_DE_CATALOGO;
}

/** Lo que hace falta de un árbol para recalcular su SubID, con el codigo de su especie ya leído. */
export type ArbolParaSubId = {
  especieId: string | null;
  especieCodigo: string | null;
  subId: string;
  posicion: number;
};

/**
 * Codigo de especie para recalcular el SubID de un árbol armado con alguno de `prefijos` (parcela +
 * grupo). Con una especie recuperada conserva el del SubID actual: NN pisaría el codigo real que
 * el árbol ya subió.
 */
export function especieCodigoParaSubId(arbol: ArbolParaSubId, prefijos: readonly string[]): string {
  if (!arbol.especieId) return UNKNOWN_SPECIES_CODE;
  if (arbol.especieCodigo && esEspecieRecuperada(arbol.especieCodigo)) {
    return especieRecuperadaDelSubId(arbol, prefijos);
  }
  return codigoParaSubId(arbol.especieCodigo);
}

/** Del más largo al más corto: si un prefijo extiende a otro, el corto calzaría con un segmento que no es la especie. */
function especieRecuperadaDelSubId(arbol: ArbolParaSubId, prefijos: readonly string[]): string {
  const candidatos = [...prefijos].sort((a, b) => b.length - a.length);
  for (const prefijo of candidatos) {
    const codigo = especieDelSubId(arbol.subId, prefijo, arbol.posicion);
    if (codigo) return codigo;
  }
  return UNKNOWN_SPECIES_CODE;
}
