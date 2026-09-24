import { db } from '../database/client';
import { groups, trees } from '../database/schema';
import { eq, asc } from 'drizzle-orm';
import { generateSubId } from '../utils/idGenerator';
import { resolveEspecieCodigo } from '../utils/speciesHelpers';

export interface CodigosDelSubId {
  parcelaCodigo: string;
  grupoCodigo: string;
}

const prefijoDe = (c: CodigosDelSubId) => `${c.parcelaCodigo}${c.grupoCodigo}`;

/**
 * Reescribe el SubID de los árboles del grupo con otros códigos de parcela o grupo. El segmento de
 * una especie recuperada se lee del SubID vigente, que puede tener todavía el prefijo anterior o
 * ya el nuevo (un árbol que el pull trajo con el código del server).
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
    const especieCodigo = await resolveEspecieCodigo(tx, arbol, [prefijoDe(anteriores), prefijoDe(nuevos)]);
    const subId = generateSubId(nuevos.parcelaCodigo, nuevos.grupoCodigo, especieCodigo, arbol.posicion);
    await tx.update(trees).set({ subId }).where(eq(trees.id, arbol.id));
  }
}

/**
 * El SubID arranca con el código de parcela: cambiarlo reescribe los árboles de todos sus grupos.
 * No marca nada para sync: en el server lo reescribe el trigger de `parcelas` (#623).
 */
export async function recalcularSubIdsDeLaParcela(
  tx: typeof db,
  parcelaId: string,
  codigos: { anterior: string; nuevo: string },
): Promise<void> {
  const grupos = await tx.select({ id: groups.id, codigo: groups.codigo })
    .from(groups).where(eq(groups.parcelaId, parcelaId));
  for (const { id, codigo } of grupos) {
    await recalcularSubIdsDelGrupo(
      tx, id,
      { parcelaCodigo: codigos.anterior, grupoCodigo: codigo },
      { parcelaCodigo: codigos.nuevo, grupoCodigo: codigo },
    );
  }
}
