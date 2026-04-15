import { supabase } from '../supabase/client';
import { db } from '../database/client';
import { subgroups, trees, plantationUsers, plantationSpecies, plantations, species } from '../database/schema';
import { eq, and, sql, inArray, isNotNull } from 'drizzle-orm';
import { notifyDataChanged } from '../database/liveQuery';
import {
  markSubGroupSynced,
  getSyncableSubGroups,
  SubGroup,
} from '../repositories/SubGroupRepository';
import { getTreesWithPendingPhotos, markPhotoSynced } from '../repositories/TreeRepository';
import { File as ExpoFile, Directory, Paths } from 'expo-file-system';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncErrorCode = 'DUPLICATE_CODE' | 'NETWORK' | 'UNKNOWN';

export interface PhotoSyncProgress {
  total: number;
  completed: number;
}

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

// ─── Photo sync helpers ───────────────────────────────────────────────────────

/**
 * Uploads a single photo file to Supabase Storage.
 * Returns { error: null } on success, { error: Error } on failure.
 */
async function uploadPhotoToStorage(
  localUri: string,
  storagePath: string
): Promise<{ error: Error | null }> {
  try {
    const file = new ExpoFile(localUri);
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from('tree-photos')
      .upload(storagePath, bytes, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    return { error: error ? new Error(error.message) : null };
  } catch (e: any) {
    return { error: e };
  }
}

/**
 * Uploads all pending photos for a plantation to Supabase Storage.
 * Per D-15: runs after SubGroup sync. Continues on individual failures (batch-safe).
 * Per D-12: stores relative storage path `plantations/{id}/trees/{id}.jpg` in Supabase trees table.
 * Per D-13: marks fotoSynced=true locally on success.
 */
export async function uploadPendingPhotos(
  plantacionId: string,
  onProgress?: (p: PhotoSyncProgress) => void
): Promise<{ uploaded: number; failed: number }> {
  const pending = await getTreesWithPendingPhotos(plantacionId);
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i++) {
    onProgress?.({ total: pending.length, completed: i });
    const tree = pending[i];
    const storagePath = `plantations/${tree.plantacionId}/trees/${tree.id}.jpg`;

    const { error } = await uploadPhotoToStorage(tree.fotoUrl, storagePath);
    if (error) {
      console.error(`[Sync] Photo upload failed for tree ${tree.id}:`, error.message);
      failed++;
    } else {
      // Update Supabase trees table with relative storage path (D-12)
      const { error: updateError } = await supabase
        .from('trees')
        .update({ foto_url: storagePath })
        .eq('id', tree.id);

      if (updateError) {
        console.error(`[Sync] foto_url update failed for tree ${tree.id}:`, updateError.message);
        failed++;
      } else {
        await markPhotoSynced(tree.id);
        uploaded++;
      }
    }
  }

  onProgress?.({ total: pending.length, completed: pending.length });
  return { uploaded, failed };
}

/**
 * Downloads remote photos for a plantation to local storage.
 * Per D-16: runs during pull flow. Skips trees with local file:// URIs.
 * Updates local fotoUrl to local path and sets fotoSynced=true on success.
 */
export async function downloadPhotosForPlantation(
  plantacionId: string,
  onProgress?: (p: PhotoSyncProgress) => void
): Promise<{ downloaded: number; failed: number }> {
  const allSubgroups = await db
    .select({ id: subgroups.id })
    .from(subgroups)
    .where(eq(subgroups.plantacionId, plantacionId));

  if (allSubgroups.length === 0) return { downloaded: 0, failed: 0 };

  const sgIds = allSubgroups.map(sg => sg.id);

  // Query trees with remote foto_url (not starting with file://)
  const allTrees = await db
    .select({ id: trees.id, fotoUrl: trees.fotoUrl, subgrupoId: trees.subgrupoId })
    .from(trees)
    .where(
      and(
        inArray(trees.subgrupoId, sgIds),
        isNotNull(trees.fotoUrl)
      )
    );

  // Filter to remote paths only (not starting with file://)
  const remoteTrees = allTrees.filter(t => t.fotoUrl && !t.fotoUrl.startsWith('file://'));

  if (remoteTrees.length === 0) return { downloaded: 0, failed: 0 };

  let downloaded = 0;
  let failed = 0;

  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true });

  for (let i = 0; i < remoteTrees.length; i++) {
    onProgress?.({ total: remoteTrees.length, completed: i });
    const tree = remoteTrees[i];

    try {
      const { data, error } = await supabase.storage
        .from('tree-photos')
        .createSignedUrl(tree.fotoUrl!, 3600);

      if (error || !data?.signedUrl) {
        console.error(`[Sync] Signed URL failed for tree ${tree.id}:`, error?.message);
        failed++;
        continue;
      }

      const destFile = new ExpoFile(dir, `photo_${tree.id}.jpg`);
      await ExpoFile.downloadFileAsync(data.signedUrl, destFile);

      // Update local fotoUrl to local path + mark as synced
      await db.update(trees)
        .set({ fotoUrl: destFile.uri, fotoSynced: true })
        .where(eq(trees.id, tree.id));

      downloaded++;
    } catch (e: any) {
      console.error(`[Sync] Photo download failed for tree ${tree.id}:`, e?.message);
      failed++;
    }
  }

  onProgress?.({ total: remoteTrees.length, completed: remoteTrees.length });
  return { downloaded, failed };
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
        pendingSync: false,
      }).onConflictDoUpdate({
        target: subgroups.id,
        set: {
          estado: sql`excluded.estado`,
          nombre: sql`excluded.nombre`,
          // Preserve local pendingSync flag — don't wipe dirty state during pull.
          // Only clear if not already pending locally.
          pendingSync: sql`CASE WHEN ${subgroups.pendingSync} = 1 THEN 1 ELSE 0 END`,
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
        // ── Conflict detection: check if local species differs from server species ──
        if (t.species_id) {
          const [localTree] = await db.select({ especieId: trees.especieId }).from(trees).where(eq(trees.id, t.id));
          if (localTree && localTree.especieId !== null && localTree.especieId !== t.species_id) {
            // Conflict: local has a different species than server
            const [serverSpecies] = await db.select({ nombre: species.nombre }).from(species).where(eq(species.id, t.species_id));
            await db.update(trees).set({
              conflictEspecieId: t.species_id,
              conflictEspecieNombre: serverSpecies?.nombre ?? 'Desconocida',
            }).where(eq(trees.id, t.id));
            console.log(`[Sync] Conflict detected for tree ${t.id}: local=${localTree.especieId}, server=${t.species_id}`);
            continue; // Skip upsert — preserve local especieId
          }
        }

        // If server has a storage-path foto_url (not a file:// URI from another device),
        // the photo is already on the server → mark as synced.
        // CRITICAL: Never store file:// paths from another device — they're meaningless locally.
        const hasFotoOnServer = !!t.foto_url && !t.foto_url.startsWith('file://');
        const serverFotoUrl = hasFotoOnServer ? t.foto_url : null;
        await db.insert(trees).values({
          id: t.id,
          subgrupoId: t.subgroup_id,
          especieId: t.species_id,
          posicion: t.posicion,
          subId: t.sub_id,
          fotoUrl: serverFotoUrl,
          fotoSynced: hasFotoOnServer,
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
            // Keep local file:// URI if it exists (photo is on this device).
            // excluded.foto_url is already sanitized (no file:// from server).
            fotoUrl: sql`CASE WHEN ${trees.fotoUrl} LIKE 'file://%' THEN ${trees.fotoUrl} ELSE excluded.foto_url END`,
            fotoSynced: hasFotoOnServer ? sql`1` : sql`${trees.fotoSynced}`,
            // Clear any previous conflict markers for non-conflicted trees
            conflictEspecieId: sql`NULL`,
            conflictEspecieNombre: sql`NULL`,
          },
        });
      }
    }
  }
}

// ─── Upload a single SubGroup ─────────────────────────────────────────────────

/**
 * Uploads photos to Storage first, then maps SubGroup + trees to RPC payload.
 * This ensures foto_url in the RPC always contains the Storage path (never null
 * or file://), so the server has the correct photo reference in a single atomic step.
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
    fotoSynced: boolean;
    plantacionId: number | null;
    globalId: number | null;
    usuarioRegistro: string;
    createdAt: string;
  }>
) {
  // Step 1: Upload local photos to Storage BEFORE the RPC.
  // Only upload photos that haven't been synced yet (fotoSynced=false).
  // Photos already in Storage (fotoSynced=true, e.g., downloaded from another device)
  // are NOT re-uploaded.
  const photoMap = new Map<string, string>();
  for (const t of sgTrees) {
    if (t.fotoUrl && t.fotoUrl.startsWith('file://') && !t.fotoSynced) {
      const storagePath = `plantations/${sg.plantacionId}/trees/${t.id}.jpg`;
      const { error } = await uploadPhotoToStorage(t.fotoUrl, storagePath);
      if (!error) {
        photoMap.set(t.id, storagePath);
        await markPhotoSynced(t.id);
      } else {
        console.error(`[Sync] Photo upload failed for tree ${t.id}:`, error.message);
      }
    }
  }

  // Step 2: Build RPC payload with Storage paths (not file:// URIs).
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
    foto_url: photoMap.get(t.id)  // Uploaded just now
      ?? (t.fotoUrl && !t.fotoUrl.startsWith('file://') ? t.fotoUrl : null),  // Already a storage path, or null
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
        await markSubGroupSynced(sg.id);
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

// ─── Global sync progress ─────────────────────────────────────────────────────

export interface GlobalSyncProgress {
  plantationName: string;
  plantationDone: number;
  plantationTotal: number;
  subgroupProgress?: SyncProgress;
}

// ─── Global sync: all local plantations ──────────────────────────────────────

/**
 * Syncs all local plantations sequentially (pull+push per plantation).
 * Global pre-steps: species catalog, offline plantations, pending edits.
 * Optional photo sync across all plantations at the end.
 */
export async function syncAllPlantations(
  onProgress?: (info: GlobalSyncProgress) => void,
  incluirFotos: boolean = true
): Promise<Array<{ plantationId: string; plantationName: string; results: SyncSubGroupResult[] }>> {
  // Refresh auth
  await supabase.auth.getSession();

  // Global pre-steps: species + offline plantations + pending edits
  try { await pullSpeciesFromServer(); } catch (e) { console.error('[Sync] Pull species failed:', e); }
  try { await uploadOfflinePlantations(); } catch (e) { console.error('[Sync] Upload offline plantations failed:', e); }
  try { await uploadPendingEdits(); } catch (e) { console.error('[Sync] Upload pending edits failed:', e); }

  const localPlantations = await db.select({ id: plantations.id, lugar: plantations.lugar }).from(plantations);
  const allResults: Array<{ plantationId: string; plantationName: string; results: SyncSubGroupResult[] }> = [];

  for (let i = 0; i < localPlantations.length; i++) {
    const p = localPlantations[i];
    onProgress?.({ plantationName: p.lugar, plantationDone: i, plantationTotal: localPlantations.length });

    try {
      // Pull for this plantation
      await pullFromServer(p.id);

      // Push syncable subgroups
      const { data: { user } } = await supabase.auth.getUser();
      const pending = await getSyncableSubGroups(p.id, user?.id);
      const results: SyncSubGroupResult[] = [];

      for (let j = 0; j < pending.length; j++) {
        const sg = pending[j];
        onProgress?.({
          plantationName: p.lugar,
          plantationDone: i,
          plantationTotal: localPlantations.length,
          subgroupProgress: { total: pending.length, completed: j, currentName: sg.nombre },
        });

        const sgTrees = await db.select().from(trees).where(eq(trees.subgrupoId, sg.id));
        try {
          const { data, error } = await uploadSubGroup(sg, sgTrees);
          if (error) {
            results.push({ success: false, subgroupId: sg.id, nombre: sg.nombre, error: 'NETWORK' });
          } else if (data?.success === true) {
            await markSubGroupSynced(sg.id);
            results.push({ success: true, subgroupId: sg.id, nombre: sg.nombre });
          } else {
            const errorCode: SyncErrorCode = data?.error === 'DUPLICATE_CODE' ? 'DUPLICATE_CODE' : 'UNKNOWN';
            results.push({ success: false, subgroupId: sg.id, nombre: sg.nombre, error: errorCode });
          }
        } catch (e) {
          results.push({ success: false, subgroupId: sg.id, nombre: sg.nombre, error: 'NETWORK' });
        }
      }

      allResults.push({ plantationId: p.id, plantationName: p.lugar, results });
    } catch (e) {
      console.error(`[Sync] Failed for plantation "${p.lugar}":`, e);
      allResults.push({ plantationId: p.id, plantationName: p.lugar, results: [] });
    }
  }

  // Photo sync across all plantations
  if (incluirFotos) {
    for (const p of localPlantations) {
      try {
        await uploadPendingPhotos(p.id);
        await downloadPhotosForPlantation(p.id);
      } catch (e) {
        console.error(`[Sync] Photo sync failed for "${p.lugar}":`, e);
      }
    }
  }

  notifyDataChanged();
  return allResults;
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

  // Step 3: Download photos from Storage to local device
  try {
    await downloadPhotosForPlantation(serverPlantation.id);
  } catch (e) {
    console.error('[Download] Photo download failed for plantation:', serverPlantation.id, e);
    // Non-fatal — plantation data is available, photos can be retried via "Descargar"
  }
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
