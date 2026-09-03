/** Admin read queries: gestión de plantación + gate de finalización. Local queries usan Drizzle/SQLite; profile listing usa Supabase (SQLite local no tiene profiles). */
import { db } from '../database/client';
import { supabase } from '../supabase/client';
import { groups, trees, plantations, plantationSpecies, species, plantationUsers } from '../database/schema';
import { eq, and, isNull, sql, count, asc } from 'drizzle-orm';

/** canFinalize needs ≥1 subgroup, all groups finalizada+synced, and zero unresolved N/N trees. */
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

  // "Done" = finalizada o sincronizada.
  const blocking = allGroups.filter(s =>
    (s.estado !== 'finalizada' && s.estado !== 'sincronizada') || s.pendingSync
  );

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

/** Returns the current estado of a plantation. */
export async function getPlantationEstado(plantacionId: string): Promise<string | null> {
  const rows = await db
    .select({ estado: plantations.estado })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));
  return rows[0]?.estado ?? null;
}

/** Returns all technicians in the admin's organization. */
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

/** Especies configuradas para una plantación, ordenadas por ordenVisual. */
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

/** Técnicos asignados a una plantación; filtra por rol_en_plantacion='tecnico' porque los admins también son miembros y no deben aparecer acá (#67). */
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

/** Count of groups a user created with pending local changes — used to warn admins before unassigning a technician. */
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

/** True if any tree in this plantation uses the given species (guards removal of an in-use species). */
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

/** Returns all species in the local catalog, ordered alphabetically. */
export async function getAllSpecies(): Promise<Array<{ id: string; nombre: string; codigo: string }>> {
  return db
    .select({ id: species.id, nombre: species.nombre, codigo: species.codigo })
    .from(species)
    .orderBy(asc(species.nombre));
}

/** True solo si TODOS los árboles tienen globalId (y hay ≥1); un set parcial cuenta como NO generado, para que la UI siga ofreciendo "Generar IDs". */
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
