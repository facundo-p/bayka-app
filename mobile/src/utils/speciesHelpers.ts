import { eq, notLike } from 'drizzle-orm';
import { species as speciesTable } from '../database/schema';
import type { db } from '../database/client';
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

type EspecieConfigurada = { especieId: string; ordenVisual: number };

/**
 * Suma a las especies elegidas las recuperadas que ya tenía la plantación. La configuración no
 * las muestra y guardar reemplaza la lista entera: sin esto se borrarían del server.
 */
export function conservarEspeciesRecuperadas(
  elegidas: EspecieConfigurada[],
  actuales: (EspecieConfigurada & { codigo: string })[],
): EspecieConfigurada[] {
  const elegidasIds = new Set(elegidas.map((e) => e.especieId));
  const recuperadas = actuales.filter((e) => esEspecieRecuperada(e.codigo) && !elegidasIds.has(e.especieId));
  const siguiente = Math.max(-1, ...elegidas.map((e) => e.ordenVisual)) + 1;
  return [
    ...elegidas,
    ...recuperadas.map((e, i) => ({ especieId: e.especieId, ordenVisual: siguiente + i })),
  ];
}

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

type Queryable = typeof db;

/** Lo que hace falta de un árbol para recalcular su SubID. */
type ArbolConSubId = { especieId: string | null; subId: string; posicion: number };

/**
 * Codigo de especie para recalcular el SubID de un árbol armado con alguno de `prefijos` (parcela +
 * grupo). Con una especie recuperada conserva el del SubID actual: NN pisaría el codigo real que
 * el árbol ya subió. Recibe `db`: la transacción es de la conexión, no un handle aparte.
 */
export async function resolveEspecieCodigo(
  queryable: Queryable,
  arbol: ArbolConSubId,
  prefijos: string | readonly string[],
): Promise<string> {
  if (!arbol.especieId) return UNKNOWN_SPECIES_CODE;
  const [sp] = await queryable.select({ codigo: speciesTable.codigo })
    .from(speciesTable)
    .where(eq(speciesTable.id, arbol.especieId));
  if (sp && esEspecieRecuperada(sp.codigo)) return especieRecuperadaDelSubId(arbol, prefijos);
  return codigoParaSubId(sp?.codigo);
}

function especieRecuperadaDelSubId(arbol: ArbolConSubId, prefijos: string | readonly string[]): string {
  const candidatos = typeof prefijos === 'string' ? [prefijos] : prefijos;
  for (const prefijo of candidatos) {
    const codigo = especieDelSubId(arbol.subId, prefijo, arbol.posicion);
    if (codigo) return codigo;
  }
  return UNKNOWN_SPECIES_CODE;
}
