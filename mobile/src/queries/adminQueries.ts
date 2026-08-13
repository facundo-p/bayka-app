/**
 * Admin read queries — plantation management and finalization gate checks.
 * All local queries use Drizzle ORM (SQLite). Profile listing uses Supabase
 * because local SQLite has no profiles table.
 *
 * Covers requirements: PLAN-06, IDGN-01
 */
import { db } from '../database/client';
import { supabase } from '../supabase/client';
import { groups, trees, plantations, plantationSpecies, species, plantationUsers } from '../database/schema';
import { eq, and, isNull, sql, count, asc } from 'drizzle-orm';

// ─── checkFinalizationGate ────────────────────────────────────────────────────

/**
 * PLAN-06
 * Checks whether a plantation can be finalized:
 * - Must have at least one subgroup
 * - All groups must be 'finalizada' AND pendingSync=false
 * Returns canFinalize: true if both conditions met, plus the list of blockers.
 */
export async function checkFinalizationGate(
  plantacionId: string
): Promise<{
  canFinalize: boolean;
  blocking: Array<{ nombre: string; estado: string; pendingSync: boolean }>;
  hasGroups: boolean;
  unresolvedNNCount: number;
  unresolvedNNGroups: number;
}> {
  const allGroups = await db
    .select({ nombre: groups.nombre, estado: groups.estado, pendingSync: groups.pendingSync })
    .from(groups)
    .where(eq(groups.plantacionId, plantacionId));

  // A subgroup is "done" if its estado is finalizada OR sincronizada.
  // sincronizada = finalized + synced to server (Phase 14 lifecycle).
  const blocking = allGroups.filter(s =>
    (s.estado !== 'finalizada' && s.estado !== 'sincronizada') || s.pendingSync
  );

  // Count unresolved N/N trees per subgroup in this plantation
  const nnRows = await db.select({
    grupoId: trees.groupId,
    cnt: count(),
  })
    .from(trees)
    .where(and(
      isNull(trees.especieId),
      sql`${trees.groupId} IN (SELECT id FROM groups WHERE plantacion_id = ${plantacionId})`
    ))
    .groupBy(trees.groupId);

  const unresolvedNNCount = nnRows.reduce((sum, r) => sum + r.cnt, 0);
  const unresolvedNNGroups = nnRows.length;

  return {
    canFinalize: allGroups.length > 0 && blocking.length === 0 && unresolvedNNCount === 0,
    blocking,
    hasGroups: allGroups.length > 0,
    unresolvedNNCount,
    unresolvedNNGroups,
  };
}

// ─── getPlantationEstado ──────────────────────────────────────────────────────

/**
 * Returns the current estado of a plantation. Used to gate UI actions.
 */
export async function getPlantationEstado(plantacionId: string): Promise<string | null> {
  const rows = await db
    .select({ estado: plantations.estado })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));
  return rows[0]?.estado ?? null;
}

// ─── getAllTechnicians ────────────────────────────────────────────────────────

/**
 * PLAN-03
 * Returns all technicians in the admin's organization.
 * MUST use Supabase (not local SQLite) — profiles table is not local.
 */
export async function getAllTechnicians(
  organizacionId: string
): Promise<Array<{ id: string; nombre: string }>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre')
    .eq('organizacion_id', organizacionId)
    .eq('rol', 'tecnico')
    // No se ofrece asignar técnicos dados de baja (no pueden loguearse).
    .eq('activo', true);

  if (error) throw error;
  return (data ?? []) as Array<{ id: string; nombre: string }>;
}

// ─── getPlantationSpeciesConfig ───────────────────────────────────────────────

/**
 * PLAN-02 / PLAN-05
 * Returns all species configured for a plantation ordered by ordenVisual.
 */
export async function getPlantationSpeciesConfig(
  plantacionId: string
): Promise<Array<{ especieId: string; nombre: string; codigo: string; ordenVisual: number }>> {
  const rows = await db
    .select({
      especieId: plantationSpecies.especieId,
      nombre: species.nombre,
      codigo: species.codigo,
      ordenVisual: plantationSpecies.ordenVisual,
    })
    .from(plantationSpecies)
    .innerJoin(species, eq(plantationSpecies.especieId, species.id))
    .where(eq(plantationSpecies.plantacionId, plantacionId));

  return rows.sort((a, b) => a.ordenVisual - b.ordenVisual);
}

// ─── getAssignedTechnicians ───────────────────────────────────────────────────

/**
 * Técnicos asignados a una plantación (SQLite local). Filtra por
 * rol_en_plantacion='tecnico': desde la migración 028 los admins también son
 * miembros y no deben aparecer en la lista de técnicos (issue #67).
 */
export async function getAssignedTechnicians(
  plantacionId: string
): Promise<Array<{ userId: string; rolEnPlantacion: string; assignedAt: string }>> {
  return db
    .select({
      userId: plantationUsers.userId,
      rolEnPlantacion: plantationUsers.rolEnPlantacion,
      assignedAt: plantationUsers.assignedAt,
    })
    .from(plantationUsers)
    .where(and(
      eq(plantationUsers.plantationId, plantacionId),
      eq(plantationUsers.rolEnPlantacion, 'tecnico'),
    ));
}

// ─── getTechnicianUnsyncedGroupCount ───────────────────────────────────────

/**
 * Returns the count of groups in a plantation created by a specific user
 * that have pending local changes (pendingSync=true).
 * Used to warn admins before unassigning a technician.
 */
export async function getTechnicianUnsyncedGroupCount(
  plantacionId: string,
  userId: string
): Promise<number> {
  const result = await db
    .select({ cnt: count() })
    .from(groups)
    .where(
      and(
        eq(groups.plantacionId, plantacionId),
        eq(groups.usuarioCreador, userId),
        eq(groups.pendingSync, true)
      )
    );
  return result[0]?.cnt ?? 0;
}

// ─── hasTreesForSpecies ───────────────────────────────────────────────────────

/**
 * EXPO-01 guard / PLAN-02 safety check
 * Returns true if any tree in this plantation uses the given species.
 * Used to prevent removal of a species that has registered trees.
 */
export async function hasTreesForSpecies(
  plantacionId: string,
  especieId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: trees.id })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(
      and(
        eq(groups.plantacionId, plantacionId),
        eq(trees.especieId, especieId)
      )
    );
  return rows.length > 0;
}

// ─── getAllSpecies ────────────────────────────────────────────────────────────

/**
 * Returns all species in the local catalog, ordered alphabetically.
 * Used by species configuration screens to avoid direct db access.
 */
export async function getAllSpecies(): Promise<Array<{ id: string; nombre: string; codigo: string }>> {
  return db
    .select({ id: species.id, nombre: species.nombre, codigo: species.codigo })
    .from(species)
    .orderBy(asc(species.nombre));
}

// ─── hasIdsGenerated ─────────────────────────────────────────────────────────

/**
 * IDGN-01 gate
 * Returns true only when EVERY tree in the plantation has globalId set (and there
 * is at least one tree). A partial set — e.g. a leftover from an incomplete sync —
 * counts as NOT generated, so the UI keeps offering "Generar IDs" to complete it.
 * Used to gate export buttons and prevent re-generation of IDs.
 */
export async function hasIdsGenerated(plantacionId: string): Promise<boolean> {
  const [row] = await db
    .select({
      total: count(),
      conId: sql<number>`COUNT(${trees.globalId})`,
    })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(eq(groups.plantacionId, plantacionId));
  return row != null && row.total > 0 && row.total === row.conId;
}
