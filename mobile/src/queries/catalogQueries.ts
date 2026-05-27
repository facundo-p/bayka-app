/**
 * Catalog query functions — server catalog discovery and local plantation ID lookup.
 * Role-gated: admin sees all org plantations, tecnico sees only assigned ones.
 *
 * Covers requirements: CATL-01, CATL-04, CATL-06
 */
import { supabase } from '../supabase/client';
import { db } from '../database/client';
import { plantations, groups } from '../database/schema';
import { eq, and, count } from 'drizzle-orm';
import { fetchAllRows } from '../services/sync/paginate';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ServerPlantation = {
  id: string;
  organizacion_id: string;
  lugar: string;
  periodo: string;
  estado: string;
  creado_por: string;
  created_at: string;
  group_count: number;
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
    const { data, error } = await fetchAllRows<any>(() =>
      supabase
        .from('plantations')
        .select('*')
        .eq('organizacion_id', organizacionId)
        .order('created_at', { ascending: false })
    );

    if (error) throw error;
    remotePlantations = data ?? [];
  } else {
    // Tecnico path: first find assigned plantation IDs
    const { data: puData, error: puError } = await fetchAllRows<any>(() =>
      supabase.from('plantation_users').select('plantation_id').eq('user_id', userId)
    );

    if (puError) throw puError;

    const assignedIds = (puData ?? []).map((row: any) => row.plantation_id);
    if (assignedIds.length === 0) return [];

    const { data, error } = await fetchAllRows<any>(() =>
      supabase
        .from('plantations')
        .select('*')
        .in('id', assignedIds)
        .order('created_at', { ascending: false })
    );

    if (error) throw error;
    remotePlantations = data ?? [];
  }

  if (remotePlantations.length === 0) return [];

  const plantationIds = remotePlantations.map((p: any) => p.id);

  // Fetch group counts: select all group rows for these plantations.
  const { data: groupRows, error: sgError } = await fetchAllRows<any>(() =>
    supabase.from('groups').select('plantation_id, id').in('plantation_id', plantationIds)
  );

  if (sgError) throw sgError;

  // Build subgroup count map: plantation_id -> count
  const groupCountMap: Record<string, number> = {};
  const groupIdsByPlantation: Record<string, string[]> = {};
  for (const sg of groupRows ?? []) {
    groupCountMap[sg.plantation_id] = (groupCountMap[sg.plantation_id] ?? 0) + 1;
    if (!groupIdsByPlantation[sg.plantation_id]) {
      groupIdsByPlantation[sg.plantation_id] = [];
    }
    groupIdsByPlantation[sg.plantation_id].push(sg.id);
  }

  // Build flat list of all subgroup IDs for tree count query
  const allGroupIds = (groupRows ?? []).map((sg: any) => sg.id);

  // Fetch tree counts: select group_id for all trees in these groups
  const treeCountMap: Record<string, number> = {};
  if (allGroupIds.length > 0) {
    const { data: treeRows, error: treeError } = await fetchAllRows<any>(() =>
      supabase.from('trees').select('group_id').in('group_id', allGroupIds)
    );

    if (treeError) throw treeError;

    // Build group_id -> plantation_id lookup
    const sgToPlantation: Record<string, string> = {};
    for (const sg of groupRows ?? []) {
      sgToPlantation[sg.id] = sg.plantation_id;
    }

    for (const tree of treeRows ?? []) {
      const plantationId = sgToPlantation[tree.group_id];
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
    group_count: groupCountMap[p.id] ?? 0,
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
 * Returns counts of groups with pending local changes for a plantation.
 * Used to determine whether to show a warning before local deletion.
 *
 * IMPORTANT: Does NOT filter by usuarioCreador — counts ALL groups
 * regardless of which technician created them.
 */
export async function getUnsyncedGroupSummary(
  plantacionId: string
): Promise<UnsyncedSummary> {
  const rows = await db
    .select({ estado: groups.estado, cnt: count() })
    .from(groups)
    .where(
      and(
        eq(groups.plantacionId, plantacionId),
        eq(groups.pendingSync, true)
      )
    )
    .groupBy(groups.estado);

  return {
    activaCount: rows.find((r) => r.estado === 'activa')?.cnt ?? 0,
    finalizadaCount: rows.find((r) => r.estado === 'finalizada')?.cnt ?? 0,
  };
}
