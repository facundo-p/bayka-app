/** Admin read queries: gestión de plantación + gate de finalización. Local queries usan Drizzle/SQLite; profile listing usa Supabase (SQLite local no tiene profiles). */
import { db } from '../database/client';
import { supabase } from '../supabase/client';
import { groups, trees, plantationSpecies, species, plantationUsers } from '../database/schema';
import { eq, and, isNull, sql, count, asc } from 'drizzle-orm';
import { ROL } from '../constants/roles';
import { ESTADO_GRUPO } from '../constants/estados';
import { getResumenDePendientes, type ResumenDePendientes } from './catalogQueries';
import { soloEspeciesDelCatalogo } from '../utils/speciesHelpers';
import { tienePendientes } from '../utils/finalizarPlantacion';

export type FinalizationGate = {
  canFinalize: boolean;
  blocking: { nombre: string; estado: string; pendingSync: boolean }[];
  hasGroups: boolean;
  unresolvedNNCount: number;
  unresolvedNNGroups: number;
  pendientes: ResumenDePendientes;
};

/** canFinalize needs ≥1 subgroup, all groups finalizada+synced, zero unresolved N/N trees and nothing left to upload. */
export async function checkFinalizationGate(plantacionId: string): Promise<FinalizationGate> {
  const [allGroups, nn, pendientes] = await Promise.all([
    getGruposDePlantacion(plantacionId),
    getNNSinResolver(plantacionId),
    getResumenDePendientes(plantacionId),
  ]);

  // "Done" = finalizada o sincronizada.
  const blocking = allGroups.filter(s =>
    (s.estado !== ESTADO_GRUPO.finalizada && s.estado !== ESTADO_GRUPO.sincronizada) || s.pendingSync
  );

  return {
    canFinalize: allGroups.length > 0 && blocking.length === 0 && nn.unresolvedNNCount === 0 && !tienePendientes(pendientes),
    blocking,
    hasGroups: allGroups.length > 0,
    ...nn,
    pendientes,
  };
}

function getGruposDePlantacion(plantacionId: string) {
  return db
    .select({ nombre: groups.nombre, estado: groups.estado, pendingSync: groups.pendingSync })
    .from(groups)
    .where(eq(groups.plantacionId, plantacionId));
}

async function getNNSinResolver(plantacionId: string) {
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

  return {
    unresolvedNNCount: nnRows.reduce((sum, r) => sum + r.cnt, 0),
    unresolvedNNGroups: nnRows.length,
  };
}

export { getPlantationEstadoDeEdicion } from './estadoDeEdicionQueries';

/** Returns all technicians in the admin's organization. */
export async function getAllTechnicians(
  organizacionId: string
): Promise<{ id: string; nombre: string }[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre')
    .eq('organizacion_id', organizacionId)
    .eq('rol', ROL.tecnico)
    // No se ofrece asignar técnicos dados de baja (no pueden loguearse).
    .eq('activo', true);

  if (error) throw error;
  return (data ?? []) as { id: string; nombre: string }[];
}

/** Técnico de la organización, con su asignación a una plantación. */
export type TecnicoAsignable = { id: string; nombre: string; assigned: boolean };

/** Los asignados primero: el admin ve de una a quién ya tiene puesto. */
export function porAsignadoYNombre(a: TecnicoAsignable, b: TecnicoAsignable): number {
  if (a.assigned !== b.assigned) return a.assigned ? -1 : 1;
  return a.nombre.localeCompare(b.nombre);
}

/** Los técnicos de la organización marcados con su asignación a la plantación. */
export async function getTechniciansWithAssignment(
  organizacionId: string,
  plantacionId: string
): Promise<TecnicoAsignable[]> {
  const [todos, asignados] = await Promise.all([
    getAllTechnicians(organizacionId),
    getAssignedTechnicians(plantacionId),
  ]);
  const idsAsignados = new Set(asignados.map((asignado) => asignado.userId));
  return todos
    .map((tecnico) => ({ ...tecnico, assigned: idsAsignados.has(tecnico.id) }))
    .sort(porAsignadoYNombre);
}

/** Especies configuradas para una plantación, por nombre (#635). */
export async function getPlantationSpeciesConfig(
  plantacionId: string
): Promise<{ especieId: string; nombre: string; codigo: string }[]> {
  const rows = await db
    .select({
      especieId: plantationSpecies.especieId,
      nombre: species.nombre,
      codigo: species.codigo,
    })
    .from(plantationSpecies)
    .innerJoin(species, eq(plantationSpecies.especieId, species.id))
    .where(eq(plantationSpecies.plantacionId, plantacionId));

  return rows.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Técnicos asignados a una plantación; filtra por rol_en_plantacion='tecnico' porque los admins también son miembros y no deben aparecer acá (#67). */
export async function getAssignedTechnicians(
  plantacionId: string
): Promise<{ userId: string; rolEnPlantacion: string; assignedAt: string }[]> {
  return db
    .select({
      userId: plantationUsers.userId,
      rolEnPlantacion: plantationUsers.rolEnPlantacion,
      assignedAt: plantationUsers.assignedAt,
    })
    .from(plantationUsers)
    .where(and(
      eq(plantationUsers.plantationId, plantacionId),
      eq(plantationUsers.rolEnPlantacion, ROL.tecnico),
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

/** Catálogo local por nombre, sin las especies recuperadas. */
export async function getAllSpecies(): Promise<{ id: string; nombre: string; codigo: string }[]> {
  return db
    .select({ id: species.id, nombre: species.nombre, codigo: species.codigo })
    .from(species)
    .where(soloEspeciesDelCatalogo())
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
