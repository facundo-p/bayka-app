/**
 * Especie de un árbol cambiada en el server y en el dispositivo a la vez (#679).
 * El pull no elige: marca el árbol con la especie del server y el usuario decide
 * en el detalle del árbol.
 */
import { db } from '../../database/client';
import { trees, species } from '../../database/schema';
import { eq, inArray } from 'drizzle-orm';
import { enTransaccionPorLotes } from '../../database/transaccion';
import { syncLog } from '../../utils/syncLogger';
import { confirmarEspeciesSubidas, type EspecieSubida } from '../../repositories/TreeRepository';

/** Nombre a mostrar cuando el server manda una especie que el catálogo local todavía no tiene. */
export const ESPECIE_DESCONOCIDA = 'Desconocida';

/** Lo que el pull lee de cada árbol local antes de escribir. */
export type ArbolLocal = {
  especieId: string | null;
  especieBaseId: string | null;
  conflictEspecieId: string | null;
  fotoUrl: string | null;
  fotoSynced: boolean;
};

type ArbolRemoto = { id: string; species_id: string | null };

const cambioLocalSinSubir = (local: ArbolLocal) => local.especieId !== local.especieBaseId;

/**
 * El server tiene otra especie y el usuario tiene que elegir. En un grupo con
 * cambios sin subir, si los dos lados se apartaron de la base. En uno ya subido,
 * si sigue sin resolver un conflicto anterior: la marca pasa a la especie vigente.
 * Un N/N del server nunca choca: nadie cambia un árbol a N/N.
 */
export function chocaLaEspecie(
  remoto: ArbolRemoto,
  local: ArbolLocal | undefined,
  grupoPendiente: boolean,
): boolean {
  if (!local || !remoto.species_id || remoto.species_id === local.especieId) return false;
  if (!grupoPendiente) return local.conflictEspecieId != null;
  return cambioLocalSinSubir(local) && remoto.species_id !== local.especieBaseId;
}

/**
 * Un árbol marcado de un grupo sin subir que ya no choca: el server pasó a la
 * especie local o volvió a la base. El pull no escribe esos árboles, así que la
 * marca se limpia aparte.
 */
export function conflictoDisuelto(
  remoto: ArbolRemoto,
  local: ArbolLocal | undefined,
  grupoPendiente: boolean,
): boolean {
  return grupoPendiente && local?.conflictEspecieId != null && !chocaLaEspecie(remoto, local, grupoPendiente);
}

export async function limpiarConflictosDeEspecie(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await enTransaccionPorLotes(ids, async (tx, lote) => {
    await tx.update(trees).set({ conflictEspecieId: null, conflictEspecieNombre: null })
      .where(inArray(trees.id, lote));
  });
}

/** Marca cada árbol con la especie del server. Devuelve los ids marcados. */
export async function marcarConflictosDeEspecie(remotos: ArbolRemoto[]): Promise<Set<string>> {
  if (remotos.length === 0) return new Set();

  // Un solo select de nombres para todos los conflictos, en vez de uno por árbol.
  const idsDeEspecie = [...new Set(remotos.map((remoto) => remoto.species_id as string))];
  const filas = await db.select({ id: species.id, nombre: species.nombre }).from(species)
    .where(inArray(species.id, idsDeEspecie));
  const nombrePorEspecie = new Map(filas.map((e) => [e.id, e.nombre]));

  await enTransaccionPorLotes(remotos, async (tx, lote) => {
    for (const remoto of lote) {
      await tx.update(trees).set({
        conflictEspecieId: remoto.species_id,
        conflictEspecieNombre: nombrePorEspecie.get(remoto.species_id as string) ?? ESPECIE_DESCONOCIDA,
      }).where(eq(trees.id, remoto.id));
    }
  });

  for (const remoto of remotos) {
    syncLog.info(`Conflicto de especie en el árbol ${remoto.id}: server=${remoto.species_id}`);
  }
  return new Set(remotos.map((remoto) => remoto.id));
}

/** Los árboles en los que `sync_subgroup` se quedó con la especie del server. */
export function especiesConservadas(respuesta: unknown): ArbolRemoto[] {
  const conservadas = (respuesta as { conservadas?: unknown } | null)?.conservadas;
  if (!Array.isArray(conservadas)) return [];
  return conservadas.filter((conservada): conservada is ArbolRemoto =>
    typeof conservada?.id === 'string' && typeof conservada?.species_id === 'string');
}

/**
 * Cierra el push de un grupo (#679). Donde el server conservó su especie, el
 * árbol queda en conflicto y el usuario elige; si no, el pull siguiente adoptaría
 * la del server sin avisar. En el resto, la especie subida pasa a ser la base.
 */
export async function asentarEspeciesSubidas(subidas: EspecieSubida[], respuesta: unknown): Promise<void> {
  await marcarConflictosDeEspecie(especiesConservadas(respuesta));
  await confirmarEspeciesSubidas(subidas);
}
