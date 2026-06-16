import { supabase } from '../../supabase/client';
import { db } from '../../database/client';
import { trees, parcelas as parcelasTable } from '../../database/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { isLocalUri, isRemoteUri } from '../../utils/photoUri';
import { syncLog } from '../../utils/syncLogger';
import {
  markGroupSynced,
  getSyncableGroups,
  Group,
} from '../../repositories/GroupRepository';
import {
  getSyncableParcelas,
  markParcelaSynced,
  Parcela,
} from '../../repositories/ParcelaRepository';
import { markPhotoSynced } from '../../repositories/TreeRepository';
import { File as ExpoFile } from 'expo-file-system';
import { SyncErrorCode, SyncGroupResult, SyncParcelaResult, SyncProgress, classifyServerError } from './types';
import { PG_ERROR } from '../../supabase/postgresErrorCodes';

/*
 * Supabase unique-constraint error shape (capturado en spike 3.3.0, 2026-05-26):
 *
 *   {
 *     code: '23505',                                          // postgres SQLSTATE
 *     details: 'Key (plantation_id, codigo)=(uuid, LP1) already exists.',
 *     message: 'duplicate key value violates unique constraint "parcelas_plantation_code_unique"',
 *     hint: null
 *   }
 *
 * Contrato estable de PostgREST (no cambia entre versiones del driver).
 * Ver mobile/src/services/sync/pushService.errors.md para detalle completo.
 *
 * El classifier (classifyParcelaRpcResult abajo) se ancla en:
 *  - error.code === '23505'   (estable)
 *  - error.details parseado con /Key \(([^)]+)\)=/  (estable)
 *
 * NUNCA usa substring matching sobre error.message (no estable entre locales
 * ni versiones de postgres). Fallback explícito: GENERIC_CONFLICT.
 */

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

// ─── Upload Parcela (Task 3.3 — antes que groups por FK D-16-13) ────────────

/**
 * Upserts a parcela (active or tombstoned) to the server. The same path
 * handles tombstone push (deletedAt != null) — Supabase recibe el upsert
 * con deleted_at y aplica el cambio.
 */
async function uploadParcela(parcela: Parcela): Promise<{ data: any; error: any }> {
  return supabase
    .from('parcelas')
    .upsert(
      {
        id: parcela.id,
        plantation_id: parcela.plantacionId,
        nombre: parcela.nombre,
        codigo: parcela.codigo,
        descripcion: parcela.descripcion,
        deleted_at: parcela.deletedAt,
        created_at: parcela.createdAt,
        updated_at: parcela.updatedAt,
      },
      { onConflict: 'id' }
    );
}

/**
 * Classify supabase upsert result for a parcela. Anclado en el shape capturado
 * en el spike (3.3.0). NUNCA substring matching sobre error.message.
 */
export function classifyParcelaRpcResult(
  parcela: Pick<Parcela, 'id' | 'nombre'>,
  _data: any,
  error: any
): SyncParcelaResult {
  if (error == null) {
    return { success: true, parcelaId: parcela.id, nombre: parcela.nombre };
  }
  syncLog.error(`Parcela upload error for "${parcela.nombre}" (${parcela.id}):`, JSON.stringify(error));

  if (error?.code === PG_ERROR.UNIQUE_VIOLATION) {
    const details: string | undefined = error?.details;
    if (!details) {
      return { success: false, parcelaId: parcela.id, nombre: parcela.nombre, error: 'GENERIC_CONFLICT' };
    }
    const match = details.match(/Key \(([^)]+)\)=/);
    if (!match) {
      return { success: false, parcelaId: parcela.id, nombre: parcela.nombre, error: 'GENERIC_CONFLICT' };
    }
    const cols = match[1].split(',').map(c => c.trim().toLowerCase());
    if (cols.includes('codigo')) {
      return { success: false, parcelaId: parcela.id, nombre: parcela.nombre, error: 'DUPLICATE_CODE' };
    }
    if (cols.includes('nombre')) {
      return { success: false, parcelaId: parcela.id, nombre: parcela.nombre, error: 'DUPLICATE_NAME' };
    }
    return { success: false, parcelaId: parcela.id, nombre: parcela.nombre, error: 'GENERIC_CONFLICT' };
  }

  // No-conflict (42501 PERMISSION / network / unknown). El detail lleva el código
  // postgres crudo para errores opacos (p.ej. 23503 FK cuando la plantación padre
  // todavía no está en el server).
  const { error: code, detail } = classifyServerError(error);
  return { success: false, parcelaId: parcela.id, nombre: parcela.nombre, error: code, detail };
}

/**
 * Upload all syncable parcelas for a plantation (active + tombstoned with
 * pending_sync=true). Only clears pending_sync on success
 * (feedback_state_lifecycle_audit.md).
 */
export async function uploadSyncableParcelas(
  plantacionId: string
): Promise<SyncParcelaResult[]> {
  const pending = await getSyncableParcelas(plantacionId);
  const results: SyncParcelaResult[] = [];

  for (const parcela of pending) {
    try {
      const { data, error } = await uploadParcela(parcela);
      const result = classifyParcelaRpcResult(parcela, data, error);
      if (result.success) await markParcelaSynced(parcela.id);
      // En cualquier error: NO markSynced — pending_sync queda en true.
      results.push(result);
    } catch (e: any) {
      syncLog.error(`Parcela upload exception "${parcela.nombre}" (${parcela.id}):`, e);
      results.push({ success: false, parcelaId: parcela.id, nombre: parcela.nombre, error: 'NETWORK' });
    }
  }

  return results;
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
    usuarioRegistro: string;
    createdAt: string;
    latitude?: number | null;
    longitude?: number | null;
    gpsAccuracy?: number | null;
    gpsCapturedAt?: string | null;
  }>
) {
  // Step 1: Upload local photos to Storage BEFORE the RPC.
  // Only upload photos that haven't been synced yet (fotoSynced=false).
  // Photos already in Storage (fotoSynced=true, e.g., downloaded from another device)
  // are NOT re-uploaded.
  // Path includes parcelaId per Phase 16 (D-16): plantations/<pid>/parcelas/<parcelaId>/trees/<treeId>.jpg
  const photoMap = new Map<string, string>();
  for (const t of sgTrees) {
    if (isLocalUri(t.fotoUrl) && !t.fotoSynced) {
      const parcelaSegment = sg.parcelaId ? `parcelas/${sg.parcelaId}/` : '';
      const storagePath = `plantations/${sg.plantacionId}/${parcelaSegment}trees/${t.id}.jpg`;
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
  // COMPAT: el server RPC `sync_subgroup` aún espera p_subgroup/p_trees con
  // claves viejas (subgroup_id) hasta que la compat-shim server-side se retire
  // en Phase 17. Mantenemos los names del payload, pero los REST calls a tablas
  // directas usan los nombres nuevos (groups, group_id).
  const p_subgroup = {
    id: sg.id,
    plantation_id: sg.plantacionId,
    parcela_id: sg.parcelaId,
    nombre: sg.nombre,
    codigo: sg.codigo,
    tipo: sg.tipo,
    // Estado REAL del grupo (antes el RPC lo hardcodeaba a 'finalizada'). El
    // server solo acepta 'activa'|'finalizada'; 'sincronizada' es un flag
    // solo-cliente que mapea a 'finalizada'.
    estado: sg.estado === 'activa' ? 'activa' : 'finalizada',
    usuario_creador: sg.usuarioCreador,
    created_at: sg.createdAt,
  };

  // NOTA: el sync de grupos NO sube los IDs generados (plantacion_id/global_id).
  // Esa persistencia la hace el RPC dedicado `update_tree_ids` en el paso de
  // "Generar IDs". El `sync_subgroup` solo sincroniza el grupo y sus árboles.
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
    latitude: t.latitude ?? null,
    longitude: t.longitude ?? null,
    gps_accuracy: t.gpsAccuracy ?? null,
    gps_captured_at: t.gpsCapturedAt ?? null,
  }));

  return supabase.rpc('sync_subgroup', { p_subgroup, p_trees });
}

// ─── RPC result classification (groups) ──────────────────────────────────────

function classifyRpcResult(
  sg: Pick<Group, 'id' | 'nombre' | 'parcelaId'>,
  data: any,
  error: any
): SyncGroupResult {
  if (error) {
    syncLog.error(`RPC error for "${sg.nombre}" (${sg.id}):`, JSON.stringify(error));
    return { success: false, groupId: sg.id, nombre: sg.nombre, error: 'NETWORK' };
  }
  if (data?.success === true) {
    return { success: true, groupId: sg.id, nombre: sg.nombre };
  }
  syncLog.error(`RPC rejected "${sg.nombre}" (${sg.id}):`, JSON.stringify(data));
  const errorCode: SyncErrorCode = data?.error === 'DUPLICATE_CODE' ? 'DUPLICATE_CODE' : 'UNKNOWN';
  return { success: false, groupId: sg.id, nombre: sg.nombre, error: errorCode };
}

// ─── Parcela-ready gate for groups (Task 3.4, D-16-16) ──────────────────────

/**
 * A group can only be pushed if its parcela is sync-ready (no pending changes,
 * not tombstoned). Returns true if parcelaId is null (legacy pre-P15 data) —
 * those groups are not blocked by parcela state.
 */
async function isParcelaSyncReady(parcelaId: string | null | undefined): Promise<boolean> {
  if (!parcelaId) return true;
  const [row] = await db.select({ id: parcelasTable.id })
    .from(parcelasTable)
    .where(and(
      eq(parcelasTable.id, parcelaId),
      eq(parcelasTable.pendingSync, false),
      isNull(parcelasTable.deletedAt),
    ))
    .limit(1);
  return row != null;
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

    // D-16-16: skip group if its parcela is not ready (still pending or tombstoned).
    if (!(await isParcelaSyncReady(sg.parcelaId))) {
      syncLog.info(`Skipping group "${sg.nombre}" (${sg.id}) — parcela ${sg.parcelaId} pending`);
      results.push({
        success: false,
        groupId: sg.id,
        nombre: sg.nombre,
        error: 'PARCELA_PENDING',
        parcelaId: sg.parcelaId ?? null,
      });
      continue;
    }

    const sgTrees = await db.select().from(trees).where(eq(trees.groupId, sg.id));
    try {
      const { data, error } = await uploadGroup(sg, sgTrees);
      const result = classifyRpcResult(sg, data, error);
      if (result.success) await markGroupSynced(sg.id);
      results.push(result);
    } catch (e) {
      syncLog.error(`Exception for "${sg.nombre}" (${sg.id}):`, e);
      results.push({ success: false, groupId: sg.id, nombre: sg.nombre, error: 'NETWORK' });
    }
  }

  return results;
}

// ─── Persist generated tree IDs (RPC dedicado) ───────────────────────────────

/**
 * Persiste los IDs generados (plantacion_id / global_id) en el server con un RPC
 * dedicado y liviano (bulk UPDATE), sin re-subir grupos/árboles completos.
 * Requiere conexión. `updated` = cantidad de filas que el server realmente tocó
 * (si es menor a las enviadas, algún árbol aún no estaba sincronizado).
 */
export async function persistGeneratedTreeIds(
  rows: Array<{ id: string; plantacionId: number; globalId: number }>
): Promise<{ success: boolean; updated: number }> {
  if (rows.length === 0) return { success: true, updated: 0 };

  const p_ids = rows.map((row) => ({
    id: row.id,
    plantacion_id: row.plantacionId,
    global_id: row.globalId,
  }));

  const { data, error } = await supabase.rpc('update_tree_ids', { p_ids });
  if (error || !data?.success) {
    syncLog.error('update_tree_ids RPC failed:', JSON.stringify(error ?? data));
    return { success: false, updated: 0 };
  }
  return { success: true, updated: data.updated ?? 0 };
}
