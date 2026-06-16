/**
 * Query functions for plantation detail screen and related views.
 * All stats, counts, and data fetching for a single plantation.
 * Screens import these — no inline db queries in screens.
 */
import { db } from '../database/client';
import { plantations, parcelas, groups, trees } from '../database/schema';
import { eq, and, count, asc, isNull, sql } from 'drizzle-orm';
import { localToday } from '../utils/dateUtils';

/** Get plantation lugar (name) by ID */
export async function getPlantationLugar(plantacionId: string) {
  return db.select({ lugar: plantations.lugar })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));
}

/** Get all groups for a plantation, ordered alphabetically by name.
 *  If `parcelaId` is provided, scopes results to that parcela. */
export async function getGroupsForPlantation(plantacionId: string, parcelaId?: string) {
  const conds = [eq(groups.plantacionId, plantacionId)];
  if (parcelaId) conds.push(eq(groups.parcelaId, parcelaId));
  return db.select().from(groups)
    .where(and(...conds))
    .orderBy(asc(groups.nombre));
}

/** Get a single subgroup by ID */
export async function getGroupById(grupoId: string) {
  return db.select().from(groups)
    .where(eq(groups.id, grupoId));
}

export interface PlantationGpsConfig {
  /** Capturar GPS cada N árboles. */
  frequency: number;
  /** Si la captura es obligatoria para registrar árboles. */
  required: boolean;
}

/** Config GPS de la plantación (frecuencia de captura y obligatoriedad). */
export async function getPlantationGpsConfig(
  plantacionId: string,
): Promise<PlantationGpsConfig | null> {
  const rows = await db
    .select({
      frequency: plantations.gpsCaptureFrequency,
      required: plantations.gpsCaptureRequired,
    })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));
  return rows[0] ?? null;
}

/** Count N/N (unresolved species) trees per subgroup in a plantation */
export async function getNNCountsPerGroup(plantacionId: string) {
  return db.select({
    grupoId: trees.groupId,
    nnCount: count(),
  })
    .from(trees)
    .where(and(
      isNull(trees.especieId),
      sql`${trees.groupId} IN (SELECT id FROM groups WHERE plantacion_id = ${plantacionId})`
    ))
    .groupBy(trees.groupId);
}

/** Count total trees per subgroup in a plantation */
export async function getTreeCountsPerGroup(plantacionId: string) {
  return db.select({
    grupoId: trees.groupId,
    treeCount: count(),
  })
    .from(trees)
    .where(sql`${trees.groupId} IN (SELECT id FROM groups WHERE plantacion_id = ${plantacionId})`)
    .groupBy(trees.groupId);
}

/** Count total trees in a plantation (all users, all states) */
export async function getTotalTreesInPlantation(plantacionId: string) {
  const result = await db.select({ total: count() })
    .from(trees)
    .where(sql`${trees.groupId} IN (SELECT id FROM groups WHERE plantacion_id = ${plantacionId})`);
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
      sql`${trees.groupId} IN (SELECT id FROM groups WHERE plantacion_id = ${plantacionId})`,
      eq(trees.usuarioRegistro, userId),
      sql`${trees.createdAt} LIKE ${todayPrefix + '%'}`
    ));
  return result[0]?.total ?? 0;
}

/** Count unsynced trees for a user in a plantation (trees in groups with pendingSync=true) */
export async function getUnsyncedTreesForUser(plantacionId: string, userId: string | null) {
  if (!userId) return 0;
  const result = await db.select({ total: count() })
    .from(trees)
    .where(and(
      sql`${trees.groupId} IN (SELECT id FROM groups WHERE plantacion_id = ${plantacionId} AND pending_sync = 1)`,
      eq(trees.usuarioRegistro, userId)
    ));
  return result[0]?.total ?? 0;
}

/** Get all unresolved N/N trees across groups in a plantation (for plantation-wide N/N resolution) */
export async function getNNTreesForPlantation(plantacionId: string) {
  return db.select({
    id: trees.id,
    posicion: trees.posicion,
    subId: trees.subId,
    fotoUrl: trees.fotoUrl,
    especieId: trees.especieId,
    grupoId: trees.groupId,
    grupoCodigo: groups.codigo,
    grupoNombre: groups.nombre,
    parcelaNombre: parcelas.nombre,
    conflictEspecieId: trees.conflictEspecieId,
    conflictEspecieNombre: trees.conflictEspecieNombre,
  })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .leftJoin(parcelas, eq(groups.parcelaId, parcelas.id))
    .where(and(
      isNull(trees.especieId),
      eq(groups.plantacionId, plantacionId)
    ))
    .orderBy(asc(parcelas.nombre), asc(groups.nombre), asc(trees.posicion));
}
