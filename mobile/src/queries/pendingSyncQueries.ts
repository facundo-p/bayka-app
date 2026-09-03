/** pendingSyncQueries — agregadores de pending_sync para el OrangeDot (groups, N/N bloqueados, fotos de árbol, parcelas). */
import { db } from '../database/client';
import { groups, trees, parcelas } from '../database/schema';
import { eq, count, and, isNotNull, sql } from 'drizzle-orm';
import { sqlIsLocalUri } from '../utils/photoUri';

export interface PendingCountQueryOpts {
  plantacionId?: string;
  userId?: string | null;
}

export function countPendingGroups(opts: PendingCountQueryOpts) {
  const conditions = [eq(groups.pendingSync, true)];
  if (opts.plantacionId) conditions.push(eq(groups.plantacionId, opts.plantacionId));
  if (opts.userId) conditions.push(eq(groups.usuarioCreador, opts.userId));
  return db.select({ cnt: count() }).from(groups).where(and(...conditions));
}

export function countNNBlockedGroups(opts: PendingCountQueryOpts) {
  if (!opts.plantacionId) return Promise.resolve([{ cnt: 0 }]);
  const conditions = [
    eq(groups.plantacionId, opts.plantacionId),
    eq(groups.estado, 'finalizada'),
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
  const conditions = pendingTreePhotoConditions();
  if (opts.plantacionId) conditions.push(eq(groups.plantacionId, opts.plantacionId));
  return db
    .select({ cnt: count() })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(and(...conditions));
}

/** Parcelas con pending_sync=true; incluye tombstones (un borrado pendiente de subir también es trabajo pendiente). */
export function countPendingParcelas(opts: PendingCountQueryOpts) {
  const conditions = [eq(parcelas.pendingSync, true)];
  if (opts.plantacionId) conditions.push(eq(parcelas.plantacionId, opts.plantacionId));
  return db.select({ cnt: count() }).from(parcelas).where(and(...conditions));
}

// Variantes agrupadas por plantación (dot por tarjeta): mismo criterio que los conteos globales, para que sincronizar una plantación apague el global (#71, follow-up).

export function countPendingGroupsByPlantation(userId?: string | null) {
  const conditions = [eq(groups.pendingSync, true)];
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
    .where(eq(parcelas.pendingSync, true))
    .groupBy(parcelas.plantacionId);
}

export function countPendingTreePhotosByPlantation() {
  return db
    .select({ plantacionId: groups.plantacionId, cnt: count() })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(and(...pendingTreePhotoConditions()))
    .groupBy(groups.plantacionId);
}
