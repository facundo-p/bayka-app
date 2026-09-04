/**
 * Catalog query functions — server catalog discovery and local plantation ID lookup.
 * Role-gated: admin sees all org plantations, tecnico sees only assigned ones.
 */
import { supabase } from '../supabase/client';
import { db } from '../database/client';
import { plantations, groups } from '../database/schema';
import { eq, and, count } from 'drizzle-orm';
import { fetchAllRows } from '../services/sync/paginate';

export type ServerPlantation = {
  id: string;
  organizacion_id: string;
  lugar: string;
  periodo: string;
  estado: string;
  creado_por: string;
  created_at: string;
  // Visibilidad administrada desde la web; true si el server no trae la columna.
  visible_in_app: boolean;
  group_count: number;
  tree_count: number;
};

/**
 * Fetches plantations from Supabase with role-based filtering.
 * - Admin: all plantations in the organization
 * - Tecnico: only plantations assigned via plantation_users
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

  const { data: groupRows, error: sgError } = await fetchAllRows<any>(() =>
    supabase.from('groups').select('plantation_id, id').in('plantation_id', plantationIds)
  );

  if (sgError) throw sgError;

  const groupCountMap: Record<string, number> = {};
  const groupIdsByPlantation: Record<string, string[]> = {};
  for (const sg of groupRows ?? []) {
    groupCountMap[sg.plantation_id] = (groupCountMap[sg.plantation_id] ?? 0) + 1;
    if (!groupIdsByPlantation[sg.plantation_id]) {
      groupIdsByPlantation[sg.plantation_id] = [];
    }
    groupIdsByPlantation[sg.plantation_id].push(sg.id);
  }

  // Flat list of subgroup IDs, needed to query tree counts across all of them at once
  const allGroupIds = (groupRows ?? []).map((sg: any) => sg.id);

  const treeCountMap: Record<string, number> = {};
  if (allGroupIds.length > 0) {
    const { data: treeRows, error: treeError } = await fetchAllRows<any>(() =>
      supabase.from('trees').select('group_id').in('group_id', allGroupIds)
    );

    if (treeError) throw treeError;

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

  return remotePlantations.map((p: any): ServerPlantation => ({
    id: p.id,
    organizacion_id: p.organizacion_id,
    lugar: p.lugar,
    periodo: p.periodo,
    estado: p.estado,
    creado_por: p.creado_por,
    created_at: p.created_at,
    visible_in_app: p.visible_in_app ?? true,
    group_count: groupCountMap[p.id] ?? 0,
    tree_count: treeCountMap[p.id] ?? 0,
  }));
}

/** Returns a Set of plantation IDs stored in local SQLite. */
export async function getLocalPlantationIds(): Promise<Set<string>> {
  const rows = await db.select({ id: plantations.id }).from(plantations);
  return new Set(rows.map((r) => r.id));
}

export type UnsyncedSummary = {
  activaCount: number;
  finalizadaCount: number;
};

/**
 * Returns counts of groups with pending local changes for a plantation.
 * Does NOT filter by usuarioCreador — counts ALL groups regardless of
 * which technician created them.
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
