/**
 * Registro de borrados a propagar al server (#467).
 *
 * Borrar un árbol o un grupo solo borraba en SQLite: el pull upserteaba de vuelta
 * la fila del server en la misma sincronización, y la renumeración terminaba
 * dejando dos árboles con el mismo SubID. Acá se anota qué se borró para que el
 * pull lo excluya y el push lo propague.
 *
 * El registro es EXPLÍCITO —una fila por id borrado— y no una semántica de
 * reemplazo ("borrá todo lo que no te mandé"): el device puede tener un set
 * parcial y el reemplazo borraría del server datos que nunca vio.
 */
import { db } from '../database/client';
import { borradosPendientes, groups } from '../database/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { ENTIDAD_BORRADA, type EntidadBorrada } from '../constants/entidadBorrada';
import { localNow } from '../utils/dateUtils';

/** Ejecutor drizzle: el cliente `db` o una transacción `tx`. */
type DbExecutor = Pick<typeof db, 'insert' | 'delete' | 'select'>;

export interface BorradoPendiente {
  id: string;
  tipo: EntidadBorrada;
  grupoId: string | null;
  plantacionId: string;
}

/**
 * Anota un borrado. Recibe el ejecutor para poder correr DENTRO de la misma
 * transacción que borra la fila: si no fuera atómico, un corte entre el delete y
 * el registro deja el borrado sin propagar y vuelve el bug.
 */
export async function registrarBorrado(
  exec: DbExecutor,
  borrado: BorradoPendiente,
): Promise<void> {
  await exec.insert(borradosPendientes).values({
    id: borrado.id,
    tipo: borrado.tipo,
    grupoId: borrado.grupoId,
    plantacionId: borrado.plantacionId,
    borradoEn: localNow(),
  }).onConflictDoNothing();
}

/** La plantación de un grupo, para anotar el borrado. `trees.plantacionId` no sirve: es el id numérico del server, no el UUID. */
export async function plantacionDelGrupo(exec: DbExecutor, grupoId: string): Promise<string | null> {
  const [grupo] = await exec
    .select({ plantacionId: groups.plantacionId })
    .from(groups)
    .where(eq(groups.id, grupoId));
  return grupo?.plantacionId ?? null;
}

export async function borradosDePlantacion(plantacionId: string): Promise<BorradoPendiente[]> {
  const filas = await db
    .select({
      id: borradosPendientes.id,
      tipo: borradosPendientes.tipo,
      grupoId: borradosPendientes.grupoId,
      plantacionId: borradosPendientes.plantacionId,
    })
    .from(borradosPendientes)
    .where(eq(borradosPendientes.plantacionId, plantacionId));
  return filas as BorradoPendiente[];
}

/** Ids de árboles borrados de una plantación: el pull los excluye aunque el grupo ya no esté pendiente. */
export async function arbolesBorradosDePlantacion(plantacionId: string): Promise<Set<string>> {
  const filas = await db
    .select({ id: borradosPendientes.id })
    .from(borradosPendientes)
    .where(and(
      eq(borradosPendientes.plantacionId, plantacionId),
      eq(borradosPendientes.tipo, ENTIDAD_BORRADA.arbol),
    ));
  return new Set(filas.map((f) => f.id));
}

/** Se llama SOLO con la confirmación del server: si falla el push, las filas quedan para el próximo intento. */
export async function limpiarBorrados(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(borradosPendientes).where(inArray(borradosPendientes.id, ids));
}
