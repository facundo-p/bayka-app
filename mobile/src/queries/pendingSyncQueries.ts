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

export function countPendingTreePhotos(opts: PendingCountQueryOpts) {
  if (!opts.plantacionId) return Promise.resolve([{ cnt: 0 }]);
  return db
    .select({ cnt: count() })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(and(
      eq(groups.plantacionId, opts.plantacionId),
      eq(groups.pendingSync, false),
      isNotNull(trees.fotoUrl),
      eq(trees.fotoSynced, false),
      sqlIsLocalUri(trees.fotoUrl),
    ));
}

/**
 * Counts parcelas with pending_sync=true. INCLUDES tombstoned rows (deleted_at
 * IS NOT NULL) — un tombstone pendiente de subir TAMBIÉN es trabajo pendiente
 * para sync. D-16-15.
 */
export function countPendingParcelas(opts: PendingCountQueryOpts) {
  const conditions = [eq(parcelas.pendingSync, true)];
  if (opts.plantacionId) conditions.push(eq(parcelas.plantacionId, opts.plantacionId));
  return db.select({ cnt: count() }).from(parcelas).where(and(...conditions));
}
