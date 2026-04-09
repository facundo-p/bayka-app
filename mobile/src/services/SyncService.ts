import { supabase } from '../supabase/client';
import { db } from '../database/client';
import { subgroups, trees, plantationUsers, plantationSpecies, plantations, species } from '../database/schema';
import { eq, and, sql } from 'drizzle-orm';
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

// ─── Pull species catalog from server ────────────────────────────────────────

/**
 * OFPL-04
 * Fetches all species from Supabase and upserts them into local SQLite.
 * Non-blocking: if Supabase returns an error, silently returns (stale catalog is acceptable).
 * CRITICAL: Does NOT delete species — codes are embedded in SubIDs; deletion would corrupt data.
 */
export async function pullSpeciesFromServer(): Promise<void> {
  const { data, error } = await supabase.from('species').select('*');
  if (error || !data) return; // non-blocking — stale catalog is acceptable
  for (const s of data) {
    await db.insert(species).values({
      id: s.id,
      codigo: s.codigo,
      nombre: s.nombre,
      nombreCientifico: s.nombre_cientifico ?? null,
      createdAt: s.created_at,
    }).onConflictDoUpdate({
      target: species.id,
      set: {
        codigo: sql`excluded.codigo`,
        nombre: sql`excluded.nombre`,
        nombreCientifico: sql`excluded.nombre_cientifico`,
      },
    });
  }
}

// ─── Upload offline-created plantations ───────────────────────────────────────

/**
 * OFPL-05 / OFPL-06
 * Uploads locally-created plantations (pendingSync=true) to Supabase.
 * For each pending plantation:
 * 1. Inserts plantation row (idempotent — 23505 = already exists on server, continue)
 * 2. Upserts plantation_species rows
 * 3. Marks pendingSync=false locally
 *
 * Non-fatal: failed plantations are logged and skipped.
 */
export async function uploadOfflinePlantations(): Promise<void> {
  const pending = await db
    .select()
    .from(plantations)
    .where(eq(plantations.pendingSync, true));

  for (const p of pending) {
    // Step 1: Upload plantation row (idempotent)
    const { error: plantError } = await supabase
      .from('plantations')
      .insert({
        id: p.id,
        organizacion_id: p.organizacionId,
        lugar: p.lugar,
        periodo: p.periodo,
        estado: p.estado,
        creado_por: p.creadoPor,
        created_at: p.createdAt,
      });

    // 23505 = duplicate key = plantation already exists on server, proceed with species upload
    if (plantError && plantError.code !== '23505') {
      console.error('[Sync] Upload plantation failed:', p.id, plantError.message);
      continue;
    }

    // Step 2: Upload plantation_species (upsert)
    const localPs = await db
      .select()
      .from(plantationSpecies)
      .where(eq(plantationSpecies.plantacionId, p.id));

    if (localPs.length > 0) {
      const { error: psError } = await supabase
        .from('plantation_species')
        .upsert(
          localPs.map((ps) => ({
            plantation_id: ps.plantacionId,
            species_id: ps.especieId,
            orden_visual: ps.ordenVisual,
          }))
        );
      if (psError) {
        console.error('[Sync] Upload plantation_species failed:', p.id, psError.message);
      }
    }

    // Step 3: Mark as synced locally
    await db
      .update(plantations)
      .set({ pendingSync: false })
      .where(eq(plantations.id, p.id));
  }
}

// ─── Upload pending plantation edits ─────────────────────────────────────────

/**
 * Pushes locally-edited plantation metadata (lugar/periodo) to Supabase.
 * For each plantation with pendingEdit=true:
 * 1. Updates Supabase with current local lugar/periodo
 * 2. Clears pendingEdit and updates *Server columns locally
 *
 * Non-fatal: failed uploads are logged and skipped.
 */
export async function uploadPendingEdits(): Promise<void> {
  const pending = await db
    .select()
    .from(plantations)
    .where(eq(plantations.pendingEdit, true));

  for (const p of pending) {
    try {
      const { error } = await supabase
        .from('plantations')
        .update({ lugar: p.lugar, periodo: p.periodo })
        .eq('id', p.id);

      if (error) {
        console.error('[Sync] Upload pending edit failed:', p.id, error.message);
        continue;
      }

      await db
        .update(plantations)
        .set({
          pendingEdit: false,
          lugarServer: p.lugar,
          periodoServer: p.periodo,
        })
        .where(eq(plantations.id, p.id));
    } catch (e: any) {
      console.error('[Sync] Upload pending edit exception:', p.id, e?.message);
    }
  }
}

// ─── Pull from server ─────────────────────────────────────────────────────────

/**
 * Downloads plantation metadata, subgroups, plantation_users, plantation_species
 * and trees from Supabase and upserts them into local SQLite.
 */
export async function pullFromServer(plantacionId: string): Promise<void> {
  console.log('[Sync] Pull starting for plantation:', plantacionId);

  // Pull plantation metadata (lugar, periodo, estado)
  const { data: remotePlantation, error: plantError } = await supabase
    .from('plantations')
    .select('lugar, periodo, estado')
    .eq('id', plantacionId)
    .single();

  if (plantError) {
    console.error('[Sync] Pull plantation metadata error:', JSON.stringify(plantError));
  } else if (remotePlantation) {
    // Always update *Server columns with latest server values
    const serverUpdate: Record<string, any> = {
      lugarServer: remotePlantation.lugar,
      periodoServer: remotePlantation.periodo,
      estado: remotePlantation.estado,
    };

    // Only overwrite main fields if there's no pending local edit
    const [local] = await db
      .select({ pendingEdit: plantations.pendingEdit })
      .from(plantations)
      .where(eq(plantations.id, plantacionId));

    if (!local?.pendingEdit) {
      serverUpdate.lugar = remotePlantation.lugar;
      serverUpdate.periodo = remotePlantation.periodo;
    }

    await db
      .update(plantations)
      .set(serverUpdate)
      .where(eq(plantations.id, plantacionId));
  }

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

  if (!puError && remotePu) {
    // Delete local plantation_users that are no longer on the server
    const remoteUserIds = new Set(remotePu.map((pu: any) => pu.user_id));
    const localPu = await db.select().from(plantationUsers)
      .where(eq(plantationUsers.plantationId, plantacionId));
    for (const local of localPu) {
      if (!remoteUserIds.has(local.userId)) {
        await db.delete(plantationUsers).where(
          and(
            eq(plantationUsers.plantationId, plantacionId),
            eq(plantationUsers.userId, local.userId),
          )
        );
      }
    }

    // Upsert remote assignments
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
      console.log('[Sync] Sample tree created_at:', remoteTrees[0].created_at, '| localToday:', require('../utils/dateUtils').localToday());
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

  // Step 1.5: Sync species catalog from server
  try {
    await pullSpeciesFromServer();
  } catch (e) {
    console.error('[Sync] Pull species failed:', e);
  }

  // Step 1.6: Upload offline-created plantations
  try {
    await uploadOfflinePlantations();
  } catch (e) {
    console.error('[Sync] Upload offline plantations failed:', e);
  }

  // Step 1.7: Upload pending plantation edits (lugar/periodo changed offline)
  try {
    await uploadPendingEdits();
  } catch (e) {
    console.error('[Sync] Upload pending edits failed:', e);
  }

  // Step 2: PULL from server before uploading
  try {
    await pullFromServer(plantacionId);
  } catch (e) {
    console.error('[Sync] Pull failed:', e);
    // Pull failure shouldn't block push — continue with upload
  }

  // Step 3: Get syncable subgroups (finalizada + no unresolved N/N), filtered by current user
  const { data: { user } } = await supabase.auth.getUser();
  const pending = await getSyncableSubGroups(plantacionId, user?.id);
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

// ─── Download types ───────────────────────────────────────────────────────────

export interface DownloadProgress {
  total: number;
  completed: number;
  currentName: string;
}

export type DownloadResult = {
  success: boolean;
  id: string;
  nombre: string;
};

// ─── Download a single plantation from server ─────────────────────────────────

/**
 * Downloads a single plantation by upserting its row into local SQLite,
 * then calling pullFromServer to sync subgroups, species, and users.
 *
 * Step 1: upsert the plantation row (onConflictDoUpdate to update estado)
 * Step 2: pullFromServer for subgroups, plantation_users, plantation_species
 */
export async function downloadPlantation(serverPlantation: {
  id: string;
  organizacion_id: string;
  lugar: string;
  periodo: string;
  estado: string;
  creado_por: string;
  created_at: string;
}): Promise<void> {
  // Step 1: Upsert plantation row using the same pattern as PlantationRepository
  await db
    .insert(plantations)
    .values({
      id: serverPlantation.id,
      organizacionId: serverPlantation.organizacion_id,
      lugar: serverPlantation.lugar,
      periodo: serverPlantation.periodo,
      estado: serverPlantation.estado,
      creadoPor: serverPlantation.creado_por,
      createdAt: serverPlantation.created_at,
      pendingSync: false,
      lugarServer: serverPlantation.lugar,
      periodoServer: serverPlantation.periodo,
    })
    .onConflictDoUpdate({
      target: plantations.id,
      set: {
        estado: sql`excluded.estado`,
        pendingSync: false,
        lugarServer: serverPlantation.lugar,
        periodoServer: serverPlantation.periodo,
      },
    });

  // Step 2: Pull related data (subgroups, plantation_users, plantation_species, trees)
  await pullFromServer(serverPlantation.id);
}

// ─── Batch download plantations ───────────────────────────────────────────────

/**
 * Downloads multiple plantations one by one, accumulating results.
 * Continues on per-plantation error (does not abort the batch).
 * Calls notifyDataChanged ONCE after the entire loop.
 *
 * @param selected - Array of server plantation objects to download
 * @param onProgress - Optional progress callback called before each download
 * @returns Array of DownloadResult with success/failure per plantation
 */
export async function batchDownload(
  selected: Array<{
    id: string;
    organizacion_id: string;
    lugar: string;
    periodo: string;
    estado: string;
    creado_por: string;
    created_at: string;
  }>,
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadResult[]> {
  const results: DownloadResult[] = [];

  for (let i = 0; i < selected.length; i++) {
    const plantation = selected[i];
    onProgress?.({ total: selected.length, completed: i, currentName: plantation.lugar });

    try {
      await downloadPlantation(plantation);
      results.push({ success: true, id: plantation.id, nombre: plantation.lugar });
    } catch (e) {
      console.error(`[Download] Failed for plantation "${plantation.lugar}" (${plantation.id}):`, e);
      results.push({ success: false, id: plantation.id, nombre: plantation.lugar });
    }
  }

  // ONCE — not inside loop (per Phase 03 decision: prevent render storm)
  notifyDataChanged();

  return results;
}
