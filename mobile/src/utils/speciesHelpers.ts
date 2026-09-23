import { eq, notLike } from 'drizzle-orm';
import { species as speciesTable } from '../database/schema';
import type { db } from '../database/client';

/** Placeholder especie codigo embedded in a tree's subId when unresolved (N/N). */
export const UNKNOWN_SPECIES_CODE = 'NN';

/** Etiqueta de un árbol cuya especie no está en el catálogo local. */
const ESPECIE_NO_RESUELTA = '??';

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
  if (!tree.especieId) return 'N/N';
  return codigoDelCatalogo(tree.especieCodigo) ?? ESPECIE_NO_RESUELTA;
}

/** Display name for a tree whose especie is not yet resolved. */
export function getSpeciesName(tree: {
  especieId?: string | null;
  especieNombre?: string | null;
}): string {
  if (!tree.especieId) return 'N/N';
  return tree.especieNombre ?? ESPECIE_NO_RESUELTA;
}

type Queryable = typeof db;

/** Codigo de especie para el SubID de un árbol, vía `codigoParaSubId`. Recibe `db`: la transacción es de la conexión, no un handle aparte. */
export async function resolveEspecieCodigo(
  queryable: Queryable,
  especieId: string | null,
): Promise<string> {
  if (!especieId) return UNKNOWN_SPECIES_CODE;
  const [sp] = await queryable.select({ codigo: speciesTable.codigo })
    .from(speciesTable)
    .where(eq(speciesTable.id, especieId));
  return codigoParaSubId(sp?.codigo);
}
