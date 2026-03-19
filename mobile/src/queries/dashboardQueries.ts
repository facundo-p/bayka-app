/**
 * Dashboard query functions — role-gated plantation list and stat computations.
 * Extracted from PlantacionesScreen to enable unit testing.
 *
 * Covers requirements: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06
 */
import { db } from '../database/client';
import { plantations, plantationUsers, subgroups, trees } from '../database/schema';
import { eq, and, count, desc, sql, ne, getTableColumns } from 'drizzle-orm';

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
 * Returns tree count per plantation for trees that are NOT yet sincronizada,
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
        ne(subgroups.estado, 'sincronizada')
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
 * Returns count of SubGroups with estado = 'finalizada' per plantation.
 * Used to show pending sync count on each plantation card.
 */
export async function getPendingSyncCounts() {
  return db
    .select({
      plantacionId: subgroups.plantacionId,
      pendingCount: count(),
    })
    .from(subgroups)
    .where(eq(subgroups.estado, 'finalizada'))
    .groupBy(subgroups.plantacionId);
}

/**
 * DASH-06
 * Returns tree count per plantation for trees registered by the current user TODAY.
 * Uses a SQL LIKE comparison against the ISO date prefix (YYYY-MM-DD).
 */
export async function getTodayTreeCounts(userId: string | null) {
  if (!userId) return [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return db
    .select({
      plantacionId: trees.plantacionId,
      treeCount: count(),
    })
    .from(trees)
    .where(
      and(
        eq(trees.usuarioRegistro, userId),
        sql`${trees.createdAt} >= ${todayStart.toISOString()}`
      )
    )
    .groupBy(trees.plantacionId);
}

/**
 * DASH-03
 * Returns total tree count per plantation regardless of user.
 * Used for the "total trees" stat on each plantation card.
 */
export async function getTotalTreeCounts() {
  return db
    .select({
      plantacionId: trees.plantacionId,
      treeCount: count(),
    })
    .from(trees)
    .groupBy(trees.plantacionId);
}
