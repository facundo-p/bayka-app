/**
 * pendingSyncQueries — agregadores de pending_sync para el OrangeDot.
 *
 * CLAUDE.md §9: cero queries en hooks. usePendingSyncCount orquesta a estas
 * funciones; toda la lógica SQL vive acá.
 *
 * Incluye:
 *  - countPendingGroups: groups con pendingSync=true (opcionalmente por user/plantación)
 *  - countNNBlockedGroups: groups finalizadas bloqueadas por N/N sin resolver
 *  - countPendingTreePhotos: trees con foto local pendiente de subir
 *  - countPendingParcelas: parcelas con pendingSync=true (incluye tombstones
 *    pendientes — D-16-15)
 */
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

/**
 * Shared filter for "foto local sin subir de grupo ya sincronizado": grupo
 * sincronizado (los grupos pendientes suben sus fotos en el propio push, y ya
 * cuentan como grupo pendiente), con foto local no sincronizada. Used by both
 * the global and per-plantation counters below so the criteria never diverge.
 */
function pendingTreePhotoConditions() {
  return [
    eq(groups.pendingSync, false),
    isNotNull(trees.fotoUrl),
    eq(trees.fotoSynced, false),
    sqlIsLocalUri(trees.fotoUrl),
  ];
}

/**
 * Fotos locales sin subir de grupos ya sincronizados (los grupos pendientes
 * suben sus fotos en el propio push, y ya cuentan como grupo pendiente).
 * Sin `plantacionId` cuenta TODAS las plantaciones — el OrangeDot global las
 * suma (issue #71: antes devolvía 0 hardcodeado y el dot las ignoraba).
 */
export function countPendingTreePhotos(opts: PendingCountQueryOpts) {
  const conditions = pendingTreePhotoConditions();
  if (opts.plantacionId) conditions.push(eq(groups.plantacionId, opts.plantacionId));
  return db
    .select({ cnt: count() })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(and(...conditions));
}

/**
 * Parcelas con pending_sync=true. INCLUYE tombstones (deleted_at IS NOT NULL):
 * un borrado pendiente de subir también es trabajo pendiente de sync. D-16-15.
 */
export function countPendingParcelas(opts: PendingCountQueryOpts) {
  const conditions = [eq(parcelas.pendingSync, true)];
  if (opts.plantacionId) conditions.push(eq(parcelas.plantacionId, opts.plantacionId));
  return db.select({ cnt: count() }).from(parcelas).where(and(...conditions));
}

// ─── Variantes agrupadas por plantación (dot por tarjeta) ────────────────────
// Mismo criterio que los conteos globales de arriba: el dot de cada tarjeta
// debe sumar exactamente lo que cuenta el ícono general, para que sincronizar
// la plantación señalada apague el global (issue #71, follow-up).

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
