/**
 * Dashboard query functions — role-gated plantation list and stat computations.
 * Extracted from PlantacionesScreen to enable unit testing.
 */
import { db } from '../database/client';
import { plantations, plantationUsers, groups, trees } from '../database/schema';
import { eq, and, count, asc, sql, getTableColumns, isNull } from 'drizzle-orm';
import { localToday } from '../utils/dateUtils';

/**
 * Admin ve todas las plantaciones, incluidas las ocultas en la app (la UI las
 * marca con badge). Tecnico solo ve las asignadas y no ocultas — el filtro es
 * de listado nomás: una plantación oculta igual sincroniza sus pendientes.
 */
export async function getPlantationsForRole(isAdmin: boolean, userId: string | null) {
  if (isAdmin) {
    return db.select().from(plantations).orderBy(asc(plantations.lugar));
  }
  if (!userId) return [];
  return db
    .select(getTableColumns(plantations))
    .from(plantations)
    .innerJoin(plantationUsers, eq(plantationUsers.plantationId, plantations.id))
    .where(
      and(
        eq(plantationUsers.userId, userId),
        eq(plantations.visibleInApp, true),
      )
    )
    .orderBy(asc(plantations.lugar));
}

/** Per-plantation tree count for pending groups, scoped to the current user's own registrations. */
export async function getUnsyncedTreeCounts(userId: string | null) {
  if (!userId) return [];
  return db
    .select({
      plantacionId: groups.plantacionId,
      treeCount: count(),
    })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(
      and(
        eq(trees.usuarioRegistro, userId),
        eq(groups.pendingSync, true)
      )
    )
    .groupBy(groups.plantacionId);
}

/** Like getUnsyncedTreeCounts but counts ALL of the user's trees regardless of subgroup estado. */
export async function getUserTotalTreeCounts(userId: string | null) {
  if (!userId) return [];
  return db
    .select({
      plantacionId: groups.plantacionId,
      treeCount: count(),
    })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(eq(trees.usuarioRegistro, userId))
    .groupBy(groups.plantacionId);
}

/** Returns count of Groups with pendingSync=true per plantation. */
export async function getPendingSyncCounts() {
  return db
    .select({
      plantacionId: groups.plantacionId,
      pendingCount: count(),
    })
    .from(groups)
    .where(eq(groups.pendingSync, true))
    .groupBy(groups.plantacionId);
}

/** Today's tree count per plantation for the current user; see plantationDetailQueries for the same LIKE-based date match. */
export async function getTodayTreeCounts(userId: string | null) {
  if (!userId) return [];
  const todayPrefix = localToday();
  return db
    .select({
      plantacionId: groups.plantacionId,
      treeCount: count(),
    })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(
      and(
        eq(trees.usuarioRegistro, userId),
        sql`${trees.createdAt} LIKE ${todayPrefix + '%'}`
      )
    )
    .groupBy(groups.plantacionId);
}

/**
 * Returns tree count per plantation for trees in synced Groups (pendingSync=false).
 */
export async function getSyncedTreeCounts() {
  return db
    .select({
      plantacionId: groups.plantacionId,
      treeCount: count(),
    })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(eq(groups.pendingSync, false))
    .groupBy(groups.plantacionId);
}

/** Total tree count per plantation (all users); JOINs through groups since trees.plantacionId is unused/null. */
export async function getTotalTreeCounts() {
  return db
    .select({
      plantacionId: groups.plantacionId,
      treeCount: count(),
    })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .groupBy(groups.plantacionId);
}

/** Returns count of unresolved N/N trees per plantation. */
export async function getUnresolvedNNCountsPerPlantation() {
  return db
    .select({
      plantacionId: groups.plantacionId,
      nnCount: count(),
    })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(isNull(trees.especieId))
    .groupBy(groups.plantacionId);
}
