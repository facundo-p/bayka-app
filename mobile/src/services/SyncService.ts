import { supabase } from '../supabase/client';
import { db } from '../database/client';
import { subgroups, trees, plantationUsers, plantationSpecies } from '../database/schema';
import { eq, sql } from 'drizzle-orm';
import { notifyDataChanged } from '../database/liveQuery';
import {
  markAsSincronizada,
  getSyncableSubGroups,
  SubGroup,
} from '../repositories/SubGroupRepository';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncErrorCode = 'DUPLICATE_CODE' | 'NETWORK' | 'UNKNOWN';

export type SyncSubGroupResult =
  | { success: true; subgroupId: string; nombre: string }
  | { success: false; subgroupId: string; nombre: string; error: SyncErrorCode };

export interface SyncProgress {
  total: number;
  completed: number;
  currentName: string;
}

// ─── Error messages (Spanish) ─────────────────────────────────────────────────

const ERROR_MESSAGES: Record<SyncErrorCode, string> = {
  DUPLICATE_CODE: 'El codigo de subgrupo ya existe en el servidor. Renombra el codigo e intenta de nuevo.',
  NETWORK: 'Error de conexion. Verifica tu internet e intenta de nuevo.',
  UNKNOWN: 'Error inesperado. Intenta de nuevo.',
};

export function getErrorMessage(code: SyncErrorCode): string {
  return ERROR_MESSAGES[code];
}

// ─── Pull from server ─────────────────────────────────────────────────────────

/**
 * Downloads subgroups, plantation_users and plantation_species from Supabase
 * and upserts them into local SQLite. Does NOT pull trees (too large).
 */
export async function pullFromServer(plantacionId: string): Promise<void> {
  console.log('[Sync] Pull starting for plantation:', plantacionId);

  // Pull subgroups
  const { data: remoteSubgroups, error: sgError } = await supabase
    .from('subgroups')
    .select('*')
    .eq('plantation_id', plantacionId);

  if (sgError) console.error('[Sync] Pull subgroups error:', JSON.stringify(sgError));
  else console.log('[Sync] Pull subgroups:', remoteSubgroups?.length ?? 0, 'rows');

  if (!sgError && remoteSubgroups && remoteSubgroups.length > 0) {
    for (const sg of remoteSubgroups) {
      await db.insert(subgroups).values({
        id: sg.id,
        plantacionId: sg.plantation_id,
        nombre: sg.nombre,
        codigo: sg.codigo,
        tipo: sg.tipo,
        estado: sg.estado,
        usuarioCreador: sg.usuario_creador,
        createdAt: sg.created_at,
      }).onConflictDoUpdate({
        target: subgroups.id,
        set: {
          estado: sql`excluded.estado`,
          nombre: sql`excluded.nombre`,
        },
      });
    }
  }

  // Pull plantation_users
  const { data: remotePu, error: puError } = await supabase
    .from('plantation_users')
    .select('*')
    .eq('plantation_id', plantacionId);

  if (puError) console.error('[Sync] Pull plantation_users error:', JSON.stringify(puError));
  else console.log('[Sync] Pull plantation_users:', remotePu?.length ?? 0, 'rows');

  if (!puError && remotePu && remotePu.length > 0) {
    for (const pu of remotePu) {
      await db.insert(plantationUsers).values({
        plantationId: pu.plantation_id,
        userId: pu.user_id,
        rolEnPlantacion: pu.rol_en_plantacion,
        assignedAt: pu.assigned_at,
      }).onConflictDoUpdate({
        target: [plantationUsers.plantationId, plantationUsers.userId],
        set: {
          rolEnPlantacion: sql`excluded.rol_en_plantacion`,
        },
      });
    }
  }

  // Pull plantation_species
  const { data: remotePs, error: psError } = await supabase
    .from('plantation_species')
    .select('*')
    .eq('plantation_id', plantacionId);

  if (psError) console.error('[Sync] Pull plantation_species error:', JSON.stringify(psError));
  else console.log('[Sync] Pull plantation_species:', remotePs?.length ?? 0, 'rows');

  if (!psError && remotePs && remotePs.length > 0) {
    for (const ps of remotePs) {
      // Server has composite PK (plantation_id, species_id), local has text id PK
      const localId = `ps-${ps.plantation_id}-${ps.species_id}`;
      await db.insert(plantationSpecies).values({
        id: localId,
        plantacionId: ps.plantation_id,
        especieId: ps.species_id,
        ordenVisual: ps.orden_visual,
      }).onConflictDoUpdate({
        target: plantationSpecies.id,
        set: {
          ordenVisual: sql`excluded.orden_visual`,
        },
      });
    }
  }

  // Pull trees for all remote subgroups in this plantation
  if (remoteSubgroups && remoteSubgroups.length > 0) {
    const sgIds = remoteSubgroups.map((sg: any) => sg.id);
    const { data: remoteTrees, error: treeError } = await supabase
      .from('trees')
      .select('*')
      .in('subgroup_id', sgIds);

    if (treeError) console.error('[Sync] Pull trees error:', JSON.stringify(treeError));
    else console.log('[Sync] Pull trees:', remoteTrees?.length ?? 0, 'rows');

    if (!treeError && remoteTrees && remoteTrees.length > 0) {
      for (const t of remoteTrees) {
        await db.insert(trees).values({
          id: t.id,
          subgrupoId: t.subgroup_id,
          especieId: t.species_id,
          posicion: t.posicion,
          subId: t.sub_id,
          fotoUrl: t.foto_url,
          plantacionId: null,
          globalId: null,
          usuarioRegistro: t.usuario_registro,
          createdAt: t.created_at,
        }).onConflictDoUpdate({
          target: trees.id,
          set: {
            especieId: sql`excluded.especie_id`,
            posicion: sql`excluded.posicion`,
            subId: sql`excluded.sub_id`,
          },
        });
      }
    }
  }
}

// ─── Upload a single SubGroup ─────────────────────────────────────────────────

/**
 * Maps local SubGroup + trees to RPC payload and calls sync_subgroup.
 */
export async function uploadSubGroup(
  sg: SubGroup,
  sgTrees: Array<{
    id: string;
    subgrupoId: string;
    especieId: string | null;
    posicion: number;
    subId: string;
    fotoUrl: string | null;
    plantacionId: number | null;
    globalId: number | null;
    usuarioRegistro: string;
    createdAt: string;
  }>
) {
  const p_subgroup = {
    id: sg.id,
    plantation_id: sg.plantacionId,
    nombre: sg.nombre,
    codigo: sg.codigo,
    tipo: sg.tipo,
    usuario_creador: sg.usuarioCreador,
    created_at: sg.createdAt,
  };

  const p_trees = sgTrees.map((t) => ({
    id: t.id,
    subgroup_id: t.subgrupoId,
    species_id: t.especieId ?? null,
    posicion: t.posicion,
    sub_id: t.subId,
    foto_url: t.fotoUrl ?? null,
    usuario_registro: t.usuarioRegistro,
    created_at: t.createdAt,
  }));

  return supabase.rpc('sync_subgroup', { p_subgroup, p_trees });
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Orchestrates pull-then-push sync for a plantation.
 * 1. Refreshes auth session
 * 2. Pulls latest data from server
 * 3. Uploads each finalizada SubGroup one by one
 * 4. Accumulates results (continues on failure)
 * 5. Notifies local data change once at the end
 */
export async function syncPlantation(
  plantacionId: string,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncSubGroupResult[]> {
  // Step 1: Refresh auth token
  await supabase.auth.getSession();

  // Step 2: PULL from server before uploading
  try {
    await pullFromServer(plantacionId);
  } catch (e) {
    console.error('[Sync] Pull failed:', e);
    // Pull failure shouldn't block push — continue with upload
  }

  // Step 3: Get syncable subgroups (finalizada + no unresolved N/N)
  const pending = await getSyncableSubGroups(plantacionId);
  const total = pending.length;
  const results: SyncSubGroupResult[] = [];

  // Step 4: Upload each SubGroup (continue on failure)
  for (let i = 0; i < pending.length; i++) {
    const sg = pending[i];

    onProgress?.({ total, completed: i, currentName: sg.nombre });

    // Load trees for this subgroup
    const sgTrees = await db.select().from(trees).where(eq(trees.subgrupoId, sg.id));

    try {
      const { data, error } = await uploadSubGroup(sg, sgTrees);

      if (error) {
        console.error(`[Sync] RPC error for "${sg.nombre}" (${sg.id}):`, JSON.stringify(error));
        results.push({ success: false, subgroupId: sg.id, nombre: sg.nombre, error: 'NETWORK' });
      } else if (data?.success === true) {
        await markAsSincronizada(sg.id);
        results.push({ success: true, subgroupId: sg.id, nombre: sg.nombre });
      } else {
        console.error(`[Sync] RPC rejected "${sg.nombre}" (${sg.id}):`, JSON.stringify(data));
        const errorCode: SyncErrorCode =
          data?.error === 'DUPLICATE_CODE' ? 'DUPLICATE_CODE' : 'UNKNOWN';
        results.push({ success: false, subgroupId: sg.id, nombre: sg.nombre, error: errorCode });
      }
    } catch (e) {
      console.error(`[Sync] Exception for "${sg.nombre}" (${sg.id}):`, e);
      results.push({ success: false, subgroupId: sg.id, nombre: sg.nombre, error: 'NETWORK' });
    }
  }

  // Step 5: Notify ONCE after the entire loop
  notifyDataChanged();

  return results;
}
