/**
 * Admin read queries — plantation management and finalization gate checks.
 * All local queries use Drizzle ORM (SQLite). Profile listing uses Supabase
 * because local SQLite has no profiles table.
 *
 * Covers requirements: PLAN-06, IDGN-04
 */
import { db } from '../database/client';
import { supabase } from '../supabase/client';
import { subgroups, trees, plantations, plantationSpecies, species, plantationUsers } from '../database/schema';
import { eq, and, isNotNull, sql, count, asc } from 'drizzle-orm';

// ─── checkFinalizationGate ────────────────────────────────────────────────────

/**
 * PLAN-06
 * Checks whether a plantation can be finalized:
 * - Must have at least one subgroup
 * - All subgroups must be 'finalizada' AND pendingSync=false
 * Returns canFinalize: true if both conditions met, plus the list of blockers.
 */
export async function checkFinalizationGate(
  plantacionId: string
): Promise<{ canFinalize: boolean; blocking: Array<{ nombre: string; estado: string; pendingSync: boolean }>; hasSubgroups: boolean }> {
  const allSubgroups = await db
    .select({ nombre: subgroups.nombre, estado: subgroups.estado, pendingSync: subgroups.pendingSync })
    .from(subgroups)
    .where(eq(subgroups.plantacionId, plantacionId));

  const blocking = allSubgroups.filter(s => s.estado !== 'finalizada' || s.pendingSync);

  return {
    canFinalize: allSubgroups.length > 0 && blocking.length === 0,
    blocking,
    hasSubgroups: allSubgroups.length > 0,
  };
}

// ─── getMaxGlobalId ───────────────────────────────────────────────────────────

/**
 * IDGN-04
 * Returns MAX(global_id) from all trees. Used to suggest seed = max + 1.
 * Returns 0 if no tree has a globalId yet.
 */
export async function getMaxGlobalId(): Promise<number> {
  const result = await db
    .select({ maxId: sql<number>`MAX(${trees.globalId})` })
    .from(trees);
  return result[0]?.maxId ?? 0;
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
    .eq('rol', 'tecnico');

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
 * Returns all technicians currently assigned to a plantation (local SQLite).
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
    .where(eq(plantationUsers.plantationId, plantacionId));
}

// ─── getTechnicianUnsyncedSubgroupCount ───────────────────────────────────────

/**
 * Returns the count of subgroups in a plantation created by a specific user
 * that have pending local changes (pendingSync=true).
 * Used to warn admins before unassigning a technician.
 */
export async function getTechnicianUnsyncedSubgroupCount(
  plantacionId: string,
  userId: string
): Promise<number> {
  const result = await db
    .select({ cnt: count() })
    .from(subgroups)
    .where(
      and(
        eq(subgroups.plantacionId, plantacionId),
        eq(subgroups.usuarioCreador, userId),
        eq(subgroups.pendingSync, true)
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
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .where(
      and(
        eq(subgroups.plantacionId, plantacionId),
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
 * Returns true if at least one tree in this plantation has globalId set.
 * Used to gate export buttons and prevent re-generation of IDs.
 */
export async function hasIdsGenerated(plantacionId: string): Promise<boolean> {
  const rows = await db
    .select({ id: trees.id })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .where(
      and(
        eq(subgroups.plantacionId, plantacionId),
        isNotNull(trees.globalId)
      )
    );
  return rows.length > 0;
}
