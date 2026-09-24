import { db } from '../database/client';
import { trees } from '../database/schema';
import { eq, asc } from 'drizzle-orm';
import { generateSubId } from '../utils/idGenerator';
import { resolveEspecieCodigo } from '../utils/speciesHelpers';

export interface CodigosDelSubId {
  parcelaCodigo: string;
  grupoCodigo: string;
}

const prefijoDe = (c: CodigosDelSubId) => `${c.parcelaCodigo}${c.grupoCodigo}`;

/**
 * Reescribe el SubID de los árboles del grupo con otros códigos de parcela o grupo. El prefijo
 * anterior hace falta para leer el segmento de una especie recuperada del SubID vigente.
 */
export async function recalcularSubIdsDelGrupo(
  tx: typeof db,
  grupoId: string,
  anteriores: CodigosDelSubId,
  nuevos: CodigosDelSubId,
): Promise<void> {
  const arboles = await tx.select().from(trees)
    .where(eq(trees.groupId, grupoId))
    .orderBy(asc(trees.posicion));

  for (const arbol of arboles) {
    const especieCodigo = await resolveEspecieCodigo(tx, arbol, prefijoDe(anteriores));
    const subId = generateSubId(nuevos.parcelaCodigo, nuevos.grupoCodigo, especieCodigo, arbol.posicion);
    await tx.update(trees).set({ subId }).where(eq(trees.id, arbol.id));
  }
}
