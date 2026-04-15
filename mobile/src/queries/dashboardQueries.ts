/**
 * Dashboard query functions — role-gated plantation list and stat computations.
 * Extracted from PlantacionesScreen to enable unit testing.
 *
 * Covers requirements: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06
 */
import { db } from '../database/client';
import { plantations, plantationUsers, subgroups, trees } from '../database/schema';
import { eq, and, count, desc, sql, getTableColumns, isNull } from 'drizzle-orm';
import { localToday } from '../utils/dateUtils';

/**
 * DASH-01 / DASH-02
 * Returns the list of plantations the user can access.
 * - Admin (isAdmin=true): all plantations ordered by newest first.
 * - Tecnico (isAdmin=false): only plantations the user is assigned to via plantation_users.
 */
export async function getPlantationsForRole(isAdmin: boolean, userId: string | null) {
  if (isAdmin) {
    return db.select().from(plantations).orderBy(desc(plantations.createdAt));
  }
  if (!userId) return [];
  return db
    .select(getTableColumns(plantations))
    .from(plantations)
    .innerJoin(plantationUsers, eq(plantationUsers.plantationId, plantations.id))
    .where(eq(plantationUsers.userId, userId))
    .orderBy(desc(plantations.createdAt));
}

/**
 * DASH-04
 * Returns tree count per plantation for trees in subgroups with pending local changes,
 * filtered by the current user's registrations.
 * Used to show "unsynced" tree count on each plantation card.
 */
export async function getUnsyncedTreeCounts(userId: string | null) {
  if (!userId) return [];
  return db
    .select({
      plantacionId: subgroups.plantacionId,
      treeCount: count(),
    })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .where(
      and(
        eq(trees.usuarioRegistro, userId),
        eq(subgroups.pendingSync, true)
      )
    )
    .groupBy(subgroups.plantacionId);
}

/**
 * DASH-05
 * Returns total tree count per plantation registered by the current user.
 * Unlike getUnsyncedTreeCounts, this counts ALL trees regardless of subgroup estado.
 */
export async function getUserTotalTreeCounts(userId: string | null) {
  if (!userId) return [];
  return db
    .select({
      plantacionId: subgroups.plantacionId,
      treeCount: count(),
    })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .where(eq(trees.usuarioRegistro, userId))
    .groupBy(subgroups.plantacionId);
}

/**
 * SYNC-07
 * Returns count of SubGroups with pendingSync=true per plantation.
 * Used to show pending sync count on each plantation card.
 */
export async function getPendingSyncCounts() {
  return db
    .select({
      plantacionId: subgroups.plantacionId,
      pendingCount: count(),
    })
    .from(subgroups)
    .where(eq(subgroups.pendingSync, true))
    .groupBy(subgroups.plantacionId);
}

/**
 * DASH-06
 * Returns tree count per plantation for trees registered by the current user TODAY.
 * Uses localToday() + LIKE for timezone-safe matching (same logic as plantationDetailQueries).
 */
export async function getTodayTreeCounts(userId: string | null) {
  if (!userId) return [];
  const todayPrefix = localToday();
  return db
    .select({
      plantacionId: subgroups.plantacionId,
      treeCount: count(),
    })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .where(
      and(
        eq(trees.usuarioRegistro, userId),
        sql`${trees.createdAt} LIKE ${todayPrefix + '%'}`
      )
    )
    .groupBy(subgroups.plantacionId);
}

/**
 * DASH-03 (synced portion)
 * Returns tree count per plantation for trees in synced SubGroups (pendingSync=false).
 */
export async function getSyncedTreeCounts() {
  return db
    .select({
      plantacionId: subgroups.plantacionId,
      treeCount: count(),
    })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .where(eq(subgroups.pendingSync, false))
    .groupBy(subgroups.plantacionId);
}

/**
 * DASH-03
 * Returns total tree count per plantation regardless of user.
 * JOINs through subgroups to get plantacionId (trees.plantacionId is unused/null).
 */
export async function getTotalTreeCounts() {
  return db
    .select({
      plantacionId: subgroups.plantacionId,
      treeCount: count(),
    })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .groupBy(subgroups.plantacionId);
}

/**
 * D-12
 * Returns count of unresolved N/N trees per plantation.
 * Used by dashboard to show N/N warning indicators on plantation cards.
 */
export async function getUnresolvedNNCountsPerPlantation() {
  return db
    .select({
      plantacionId: subgroups.plantacionId,
      nnCount: count(),
    })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .where(isNull(trees.especieId))
    .groupBy(subgroups.plantacionId);
}
