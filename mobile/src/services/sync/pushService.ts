import { supabase } from '../../supabase/client';
import { db } from '../../database/client';
import { trees } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { isLocalUri, isRemoteUri } from '../../utils/photoUri';
import { syncLog } from '../../utils/syncLogger';
import {
  markGroupSynced,
  getSyncableGroups,
  Group,
} from '../../repositories/GroupRepository';
import { markPhotoSynced } from '../../repositories/TreeRepository';
import { File as ExpoFile } from 'expo-file-system';
import { SyncErrorCode, SyncGroupResult, SyncProgress } from './types';

// ─── Photo upload helper (internal) ─────────────────────────────────────────

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

// ─── Upload a single Group ─────────────────────────────────────────────────

/**
 * Uploads photos to Storage first, then maps Group + trees to RPC payload.
 * This ensures foto_url in the RPC always contains the Storage path (never null
 * or file://), so the server has the correct photo reference in a single atomic step.
 */
export async function uploadGroup(
  sg: Group,
  sgTrees: Array<{
    id: string;
    groupId: string;
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
    if (isLocalUri(t.fotoUrl) && !t.fotoSynced) {
      const storagePath = `plantations/${sg.plantacionId}/trees/${t.id}.jpg`;
      const { error } = await uploadPhotoToStorage(t.fotoUrl, storagePath);
      if (!error) {
        photoMap.set(t.id, storagePath);
        await markPhotoSynced(t.id);
      } else {
        syncLog.error(`Photo upload failed for tree ${t.id}:`, error.message);
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
    subgroup_id: t.groupId,
    species_id: t.especieId ?? null,
    posicion: t.posicion,
    sub_id: t.subId,
    foto_url: photoMap.get(t.id)  // Uploaded just now
      ?? (isRemoteUri(t.fotoUrl) ? t.fotoUrl : null),
    usuario_registro: t.usuarioRegistro,
    created_at: t.createdAt,
  }));

  return supabase.rpc('sync_subgroup', { p_subgroup, p_trees });
}

// ─── RPC result classification ───────────────────────────────────────────────

function classifyRpcResult(
  sgId: string,
  sgNombre: string,
  data: any,
  error: any
): SyncGroupResult {
  if (error) {
    syncLog.error(`RPC error for "${sgNombre}" (${sgId}):`, JSON.stringify(error));
    return { success: false, groupId: sgId, nombre: sgNombre, error: 'NETWORK' };
  }
  if (data?.success === true) {
    return { success: true, groupId: sgId, nombre: sgNombre };
  }
  syncLog.error(`RPC rejected "${sgNombre}" (${sgId}):`, JSON.stringify(data));
  const errorCode: SyncErrorCode = data?.error === 'DUPLICATE_CODE' ? 'DUPLICATE_CODE' : 'UNKNOWN';
  return { success: false, groupId: sgId, nombre: sgNombre, error: errorCode };
}

// ─── Upload syncable groups ───────────────────────────────────────────────

export async function uploadSyncableGroups(
  plantacionId: string,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncGroupResult[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const pending = await getSyncableGroups(plantacionId, user?.id);
  const results: SyncGroupResult[] = [];

  for (let i = 0; i < pending.length; i++) {
    const sg = pending[i];
    onProgress?.({ total: pending.length, completed: i, currentName: sg.nombre });

    const sgTrees = await db.select().from(trees).where(eq(trees.groupId, sg.id));
    try {
      const { data, error } = await uploadGroup(sg, sgTrees);
      const result = classifyRpcResult(sg.id, sg.nombre, data, error);
      if (result.success) await markGroupSynced(sg.id);
      results.push(result);
    } catch (e) {
      syncLog.error(`Exception for "${sg.nombre}" (${sg.id}):`, e);
      results.push({ success: false, groupId: sg.id, nombre: sg.nombre, error: 'NETWORK' });
    }
  }

  return results;
}
