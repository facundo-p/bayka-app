/**
 * Registro de borrados a propagar al server (#467), incluidas las fotos quitadas
 * de árboles que siguen existiendo (#498).
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
 *
 * El id es la clave: borrar un árbol con la foto quitada pendiente pisa ese
 * registro, porque borrar la fila ya se lleva la foto (#498). Al revés no pasa.
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
  }).onConflictDoUpdate({
    target: borradosPendientes.id,
    set: { tipo: borrado.tipo, grupoId: borrado.grupoId },
    setWhere: eq(borradosPendientes.tipo, ENTIDAD_BORRADA.foto),
  });
}

/** Poner otra foto deja sin efecto la que se había quitado: la nueva se sube por el camino normal. */
export async function descartarFotoQuitada(exec: DbExecutor, arbolId: string): Promise<void> {
  await exec.delete(borradosPendientes).where(and(
    eq(borradosPendientes.id, arbolId),
    eq(borradosPendientes.tipo, ENTIDAD_BORRADA.foto),
  ));
}

/** La plantación de un grupo, para anotar el borrado. `trees.plantacionId` no sirve: es el id numérico del server, no el UUID. */
export async function plantacionDelGrupo(exec: DbExecutor, grupoId: string): Promise<string | null> {
  const [grupo] = await exec
    .select({ plantacionId: groups.plantacionId })
    .from(groups)
    .where(eq(groups.id, grupoId));
  return grupo?.plantacionId ?? null;
}

export async function borradosDePlantacion(
  plantacionId: string,
  tipos: readonly EntidadBorrada[],
): Promise<BorradoPendiente[]> {
  const filas = await db
    .select({
      id: borradosPendientes.id,
      tipo: borradosPendientes.tipo,
      grupoId: borradosPendientes.grupoId,
      plantacionId: borradosPendientes.plantacionId,
    })
    .from(borradosPendientes)
    .where(and(eq(borradosPendientes.plantacionId, plantacionId), inArray(borradosPendientes.tipo, [...tipos])));
  return filas as BorradoPendiente[];
}

export interface BorradosPorTipo {
  arboles: Set<string>;
  grupos: Set<string>;
  /** Árboles con la foto quitada: el pull no tiene que restaurarla (#498). */
  fotos: Set<string>;
}

/**
 * Ids borrados de una plantación, por tipo. El pull los excluye aunque el grupo ya
 * no esté pendiente — y en el caso de un grupo, la fila local ya no existe, así que
 * `pendingSync` no puede decir nada: sin esto el pull lo resucita entero antes de
 * que el push alcance a borrarlo en el server.
 */
export async function borradosPorTipo(plantacionId: string): Promise<BorradosPorTipo> {
  const filas = await db
    .select({ id: borradosPendientes.id, tipo: borradosPendientes.tipo })
    .from(borradosPendientes)
    .where(eq(borradosPendientes.plantacionId, plantacionId));
  const idsDe = (tipo: EntidadBorrada) => new Set(filas.filter((f) => f.tipo === tipo).map((f) => f.id));
  return {
    arboles: idsDe(ENTIDAD_BORRADA.arbol),
    grupos: idsDe(ENTIDAD_BORRADA.grupo),
    fotos: idsDe(ENTIDAD_BORRADA.foto),
  };
}

/**
 * Se llama SOLO con la confirmación del server: si falla el push, las filas quedan
 * para el próximo intento. Filtra por tipo porque, mientras el push viaja, borrar
 * el árbol puede convertir una foto quitada en un borrado de fila con el mismo id.
 */
export async function limpiarBorrados(ids: string[], tipos: readonly EntidadBorrada[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(borradosPendientes).where(and(
    inArray(borradosPendientes.id, ids),
    inArray(borradosPendientes.tipo, [...tipos]),
  ));
}
