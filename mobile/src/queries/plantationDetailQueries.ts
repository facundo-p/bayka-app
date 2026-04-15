/**
 * Query functions for plantation detail screen and related views.
 * All stats, counts, and data fetching for a single plantation.
 * Screens import these — no inline db queries in screens.
 */
import { db } from '../database/client';
import { plantations, subgroups, trees } from '../database/schema';
import { eq, and, count, desc, asc, isNull, sql } from 'drizzle-orm';
import { localToday } from '../utils/dateUtils';

/** Get plantation lugar (name) by ID */
export async function getPlantationLugar(plantacionId: string) {
  return db.select({ lugar: plantations.lugar })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));
}

/** Get all subgroups for a plantation, ordered by newest first */
export async function getSubgroupsForPlantation(plantacionId: string) {
  return db.select().from(subgroups)
    .where(eq(subgroups.plantacionId, plantacionId))
    .orderBy(desc(subgroups.createdAt));
}

/** Get a single subgroup by ID */
export async function getSubgroupById(subgrupoId: string) {
  return db.select().from(subgroups)
    .where(eq(subgroups.id, subgrupoId));
}

/** Count N/N (unresolved species) trees per subgroup in a plantation */
export async function getNNCountsPerSubgroup(plantacionId: string) {
  return db.select({
    subgrupoId: trees.subgrupoId,
    nnCount: count(),
  })
    .from(trees)
    .where(and(
      isNull(trees.especieId),
      sql`${trees.subgrupoId} IN (SELECT id FROM subgroups WHERE plantacion_id = ${plantacionId})`
    ))
    .groupBy(trees.subgrupoId);
}

/** Count total trees per subgroup in a plantation */
export async function getTreeCountsPerSubgroup(plantacionId: string) {
  return db.select({
    subgrupoId: trees.subgrupoId,
    treeCount: count(),
  })
    .from(trees)
    .where(sql`${trees.subgrupoId} IN (SELECT id FROM subgroups WHERE plantacion_id = ${plantacionId})`)
    .groupBy(trees.subgrupoId);
}

/** Count total trees in a plantation (all users, all states) */
export async function getTotalTreesInPlantation(plantacionId: string) {
  const result = await db.select({ total: count() })
    .from(trees)
    .where(sql`${trees.subgrupoId} IN (SELECT id FROM subgroups WHERE plantacion_id = ${plantacionId})`);
  return result[0]?.total ?? 0;
}

/**
 * Count trees registered TODAY by a user in a plantation.
 * Uses localToday() + LIKE for timezone-safe date matching.
 * This is the SINGLE source of truth for "today's trees" — used by both
 * PlantacionesScreen (via dashboardQueries) and PlantationDetailScreen.
 */
export async function getTodayTreesForUser(plantacionId: string, userId: string | null) {
  if (!userId) return 0;
  const todayPrefix = localToday();
  const result = await db.select({ total: count() })
    .from(trees)
    .where(and(
      sql`${trees.subgrupoId} IN (SELECT id FROM subgroups WHERE plantacion_id = ${plantacionId})`,
      eq(trees.usuarioRegistro, userId),
      sql`${trees.createdAt} LIKE ${todayPrefix + '%'}`
    ));
  return result[0]?.total ?? 0;
}

/** Count unsynced trees for a user in a plantation (trees in subgroups with pendingSync=true) */
export async function getUnsyncedTreesForUser(plantacionId: string, userId: string | null) {
  if (!userId) return 0;
  const result = await db.select({ total: count() })
    .from(trees)
    .where(and(
      sql`${trees.subgrupoId} IN (SELECT id FROM subgroups WHERE plantacion_id = ${plantacionId} AND pending_sync = 1)`,
      eq(trees.usuarioRegistro, userId)
    ));
  return result[0]?.total ?? 0;
}

/** Get all unresolved N/N trees across subgroups in a plantation (for plantation-wide N/N resolution) */
export async function getNNTreesForPlantation(plantacionId: string) {
  return db.select({
    id: trees.id,
    posicion: trees.posicion,
    subId: trees.subId,
    fotoUrl: trees.fotoUrl,
    especieId: trees.especieId,
    subgrupoId: trees.subgrupoId,
    subgrupoCodigo: subgroups.codigo,
    subgrupoNombre: subgroups.nombre,
    conflictEspecieId: trees.conflictEspecieId,
    conflictEspecieNombre: trees.conflictEspecieNombre,
  })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .where(and(
      isNull(trees.especieId),
      eq(subgroups.plantacionId, plantacionId)
    ))
    .orderBy(asc(subgroups.nombre), asc(trees.posicion));
}

/**
 * D-07
 * Get unresolved N/N trees filtered by the subgroup creator (tecnico view).
 * Same shape as getNNTreesForPlantation but scoped to a single user's subgroups.
 */
export async function getNNTreesForPlantationByUser(plantacionId: string, userId: string) {
  return db.select({
    id: trees.id,
    posicion: trees.posicion,
    subId: trees.subId,
    fotoUrl: trees.fotoUrl,
    especieId: trees.especieId,
    subgrupoId: trees.subgrupoId,
    subgrupoCodigo: subgroups.codigo,
    subgrupoNombre: subgroups.nombre,
    conflictEspecieId: trees.conflictEspecieId,
    conflictEspecieNombre: trees.conflictEspecieNombre,
  })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .where(and(
      isNull(trees.especieId),
      eq(subgroups.plantacionId, plantacionId),
      eq(subgroups.usuarioCreador, userId),
    ))
    .orderBy(asc(subgroups.nombre), asc(trees.posicion));
}
