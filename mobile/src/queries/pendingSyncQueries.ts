/** pendingSyncQueries — agregadores de pending_sync para el OrangeDot (groups, N/N bloqueados, fotos de árbol, parcelas). */
import { db } from '../database/client';
import { groups, trees, parcelas, plantations } from '../database/schema';
import { eq, count, and, isNotNull, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { sqlIsLocalUri } from '../utils/photoUri';
import { ESTADO_GRUPO } from '../constants/estados';

export interface PendingCountQueryOpts {
  plantacionId?: string;
  userId?: string | null;
}

/**
 * Lo pendiente de una plantación eliminada en el servidor ya no se puede subir: si
 * contara, el punto naranja quedaría encendido para siempre (#518). Su tarjeta ya
 * muestra el estado propio.
 */
export function noEliminadaEnServidor(plantacionId: SQLiteColumn): SQL {
  return sql`${plantacionId} NOT IN (SELECT ${plantations.id} FROM ${plantations} WHERE ${plantations.eliminadaEnServidorEn} IS NOT NULL)`;
}

/** Con plantación, el detalle de esa (aunque esté eliminada); sin plantación, el global. */
function deLaPlantacionOGlobal(columna: SQLiteColumn, plantacionId?: string): SQL {
  return plantacionId ? eq(columna, plantacionId) : noEliminadaEnServidor(columna);
}

export function countPendingGroups(opts: PendingCountQueryOpts) {
  const conditions = [eq(groups.pendingSync, true), deLaPlantacionOGlobal(groups.plantacionId, opts.plantacionId)];
  if (opts.userId) conditions.push(eq(groups.usuarioCreador, opts.userId));
  return db.select({ cnt: count() }).from(groups).where(and(...conditions));
}

export function countNNBlockedGroups(opts: PendingCountQueryOpts) {
  if (!opts.plantacionId) return Promise.resolve([{ cnt: 0 }]);
  const conditions = [
    eq(groups.plantacionId, opts.plantacionId),
    eq(groups.estado, ESTADO_GRUPO.finalizada),
    sql`EXISTS (SELECT 1 FROM trees WHERE trees.group_id = ${groups.id} AND trees.especie_id IS NULL)`,
  ];
  if (opts.userId) conditions.push(eq(groups.usuarioCreador, opts.userId));
  return db.select({ cnt: count() }).from(groups).where(and(...conditions));
}

/** Filtro compartido "foto local sin subir de grupo ya sincronizado" (los grupos pendientes suben sus fotos en el push); usado por ambos contadores de abajo para que el criterio no diverja. */
function pendingTreePhotoConditions() {
  return [
    eq(groups.pendingSync, false),
    isNotNull(trees.fotoUrl),
    eq(trees.fotoSynced, false),
    sqlIsLocalUri(trees.fotoUrl),
  ];
}

/** Fotos locales sin subir de grupos ya sincronizados; sin `plantacionId` cuenta todas (el OrangeDot global las suma, #71). */
export function countPendingTreePhotos(opts: PendingCountQueryOpts) {
  const conditions = [...pendingTreePhotoConditions(), deLaPlantacionOGlobal(groups.plantacionId, opts.plantacionId)];
  return db
    .select({ cnt: count() })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(and(...conditions));
}

/** Parcelas con pending_sync=true; incluye tombstones (un borrado pendiente de subir también es trabajo pendiente). */
export function countPendingParcelas(opts: PendingCountQueryOpts) {
  const conditions = [eq(parcelas.pendingSync, true), deLaPlantacionOGlobal(parcelas.plantacionId, opts.plantacionId)];
  return db.select({ cnt: count() }).from(parcelas).where(and(...conditions));
}

/**
 * Todas las fotos locales sin subir de una plantación, estén o no en grupos pendientes:
 * es lo que se pierde al eliminarla del dispositivo (#478).
 */
export function countFotosSinSubirDePlantacion(plantacionId: string) {
  return db
    .select({ cnt: count() })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(and(
      eq(groups.plantacionId, plantacionId),
      isNotNull(trees.fotoUrl),
      eq(trees.fotoSynced, false),
      sqlIsLocalUri(trees.fotoUrl),
    ));
}

// Variantes agrupadas por plantación (dot por tarjeta): mismo criterio que los conteos globales, para que sincronizar una plantación apague el global (#71, follow-up).

export function countPendingGroupsByPlantation(userId?: string | null) {
  const conditions = [eq(groups.pendingSync, true), noEliminadaEnServidor(groups.plantacionId)];
  if (userId) conditions.push(eq(groups.usuarioCreador, userId));
  return db
    .select({ plantacionId: groups.plantacionId, cnt: count() })
    .from(groups)
    .where(and(...conditions))
    .groupBy(groups.plantacionId);
}

export function countPendingParcelasByPlantation() {
  return db
    .select({ plantacionId: parcelas.plantacionId, cnt: count() })
    .from(parcelas)
    .where(and(eq(parcelas.pendingSync, true), noEliminadaEnServidor(parcelas.plantacionId)))
    .groupBy(parcelas.plantacionId);
}

export function countPendingTreePhotosByPlantation() {
  return db
    .select({ plantacionId: groups.plantacionId, cnt: count() })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(and(...pendingTreePhotoConditions(), noEliminadaEnServidor(groups.plantacionId)))
    .groupBy(groups.plantacionId);
}
