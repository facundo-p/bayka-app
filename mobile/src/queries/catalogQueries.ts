/**
 * Catalog query functions — server catalog discovery and local plantation ID lookup.
 * Role-gated: admin sees all org plantations, tecnico sees only assigned ones.
 *
 * Covers requirements: CATL-01, CATL-04, CATL-06
 */
import { supabase } from '../supabase/client';
import { db } from '../database/client';
import { plantations, subgroups } from '../database/schema';
import { eq, and, sql, count } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ServerPlantation = {
  id: string;
  organizacion_id: string;
  lugar: string;
  periodo: string;
  estado: string;
  creado_por: string;
  created_at: string;
  subgroup_count: number;
  tree_count: number;
};

// ─── Server catalog query ─────────────────────────────────────────────────────

/**
 * Fetches plantations from Supabase with role-based filtering.
 * - Admin: all plantations in the organization
 * - Tecnico: only plantations assigned via plantation_users
 *
 * Also fetches subgroup and tree counts per plantation and merges them.
 * Throws if any Supabase query returns an error.
 */
export async function getServerCatalog(
  isAdmin: boolean,
  userId: string,
  organizacionId: string
): Promise<ServerPlantation[]> {
  let remotePlantations: any[];

  if (isAdmin) {
    // Admin path: all plantations in the org
    const { data, error } = await supabase
      .from('plantations')
      .select('*')
      .eq('organizacion_id', organizacionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    remotePlantations = data ?? [];
  } else {
    // Tecnico path: first find assigned plantation IDs
    const { data: puData, error: puError } = await supabase
      .from('plantation_users')
      .select('plantation_id')
      .eq('user_id', userId);

    if (puError) throw puError;

    const assignedIds = (puData ?? []).map((row: any) => row.plantation_id);
    if (assignedIds.length === 0) return [];

    const { data, error } = await supabase
      .from('plantations')
      .select('*')
      .in('id', assignedIds)
      .order('created_at', { ascending: false });

    if (error) throw error;
    remotePlantations = data ?? [];
  }

  if (remotePlantations.length === 0) return [];

  const plantationIds = remotePlantations.map((p: any) => p.id);

  // Fetch subgroup counts: select all subgroup rows for these plantations
  const { data: subgroupRows, error: sgError } = await supabase
    .from('subgroups')
    .select('plantation_id, id')
    .in('plantation_id', plantationIds);

  if (sgError) throw sgError;

  // Build subgroup count map: plantation_id -> count
  const subgroupCountMap: Record<string, number> = {};
  const subgroupIdsByPlantation: Record<string, string[]> = {};
  for (const sg of subgroupRows ?? []) {
    subgroupCountMap[sg.plantation_id] = (subgroupCountMap[sg.plantation_id] ?? 0) + 1;
    if (!subgroupIdsByPlantation[sg.plantation_id]) {
      subgroupIdsByPlantation[sg.plantation_id] = [];
    }
    subgroupIdsByPlantation[sg.plantation_id].push(sg.id);
  }

  // Build flat list of all subgroup IDs for tree count query
  const allSubgroupIds = (subgroupRows ?? []).map((sg: any) => sg.id);

  // Fetch tree counts: select subgroup_id for all trees in these subgroups
  const treeCountMap: Record<string, number> = {};
  if (allSubgroupIds.length > 0) {
    const { data: treeRows, error: treeError } = await supabase
      .from('trees')
      .select('subgroup_id')
      .in('subgroup_id', allSubgroupIds);

    if (treeError) throw treeError;

    // Build subgroup_id -> plantation_id lookup
    const sgToPlantation: Record<string, string> = {};
    for (const sg of subgroupRows ?? []) {
      sgToPlantation[sg.id] = sg.plantation_id;
    }

    for (const tree of treeRows ?? []) {
      const plantationId = sgToPlantation[tree.subgroup_id];
      if (plantationId) {
        treeCountMap[plantationId] = (treeCountMap[plantationId] ?? 0) + 1;
      }
    }
  }

  // Merge counts into ServerPlantation objects
  return remotePlantations.map((p: any): ServerPlantation => ({
    id: p.id,
    organizacion_id: p.organizacion_id,
    lugar: p.lugar,
    periodo: p.periodo,
    estado: p.estado,
    creado_por: p.creado_por,
    created_at: p.created_at,
    subgroup_count: subgroupCountMap[p.id] ?? 0,
    tree_count: treeCountMap[p.id] ?? 0,
  }));
}

// ─── Local plantation ID lookup ───────────────────────────────────────────────

/**
 * Returns a Set of plantation IDs stored in local SQLite.
 * Used to determine which server plantations are already downloaded.
 */
export async function getLocalPlantationIds(): Promise<Set<string>> {
  const rows = await db.select({ id: plantations.id }).from(plantations);
  return new Set(rows.map((r) => r.id));
}

// --- Unsynced subgroup detection ---------------------------------------------

export type UnsyncedSummary = {
  activaCount: number;
  finalizadaCount: number;
};

/**
 * Returns counts of non-synchronized subgroups for a plantation.
 * Used to determine whether to show a warning before local deletion.
 *
 * IMPORTANT: Does NOT filter by usuarioCreador — counts ALL subgroups
 * regardless of which technician created them.
 */
export async function getUnsyncedSubgroupSummary(
  plantacionId: string
): Promise<UnsyncedSummary> {
  const rows = await db
    .select({ estado: subgroups.estado, cnt: count() })
    .from(subgroups)
    .where(
      and(
        eq(subgroups.plantacionId, plantacionId),
        sql`${subgroups.estado} != 'sincronizada'`
      )
    )
    .groupBy(subgroups.estado);

  return {
    activaCount: rows.find((r) => r.estado === 'activa')?.cnt ?? 0,
    finalizadaCount: rows.find((r) => r.estado === 'finalizada')?.cnt ?? 0,
  };
}
