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
import { SyncErrorCode, SyncGroupResult, SyncParcelaResult, SyncProgress, classifyServerError } from './types';
import { PG_ERROR } from '../../supabase/postgresErrorCodes';
import { uploadPhotoToStorage } from './storageUpload';

// Supabase 23505 (unique violation): `details` = 'Key (cols)=(vals) already exists' — classifyParcelaRpcResult parsea details, nunca message (no estable entre locales/versiones de postgres). Fallback: GENERIC_CONFLICT.

// ─── Upload Parcela (antes que groups por FK) ────────────

/** Upsert de parcela (activa o tombstoned): el mismo path sube deletedAt y Supabase aplica el cambio. */
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

/** Clasifica el resultado de un upsert de parcela en un SyncParcelaResult. */
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

  // No-conflict (42501/network/unknown): detail lleva el código postgres crudo para errores
  // opacos (p.ej. 23503 FK si la plantación padre aún no está en el server).
  const { error: code, detail } = classifyServerError(error);
  return { success: false, parcelaId: parcela.id, nombre: parcela.nombre, error: code, detail };
}

/** Sube todas las parcelas syncable de una plantación (activas + tombstoned con pending_sync=true); solo limpia pending_sync en éxito. */
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

/** Sube fotos a Storage antes del RPC para que foto_url siempre lleve el path de Storage (nunca null/file://) en un solo paso atómico. */
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
  // Solo resube fotos con fotoSynced=false; las que ya están en Storage (de otro device) se saltean.
  const photoMap = new Map<string, string>();
  for (const t of sgTrees) {
    if (isLocalUri(t.fotoUrl) && !t.fotoSynced) {
      const storagePath = `plantations/${sg.plantacionId}/parcelas/${sg.parcelaId}/trees/${t.id}.jpg`;
      const { error } = await uploadPhotoToStorage(t.fotoUrl, storagePath);
      if (!error) {
        photoMap.set(t.id, storagePath);
        await markPhotoSynced(t.id);
      } else {
        syncLog.error(`Photo upload failed for tree ${t.id}:`, error.message);
      }
    }
  }

  // COMPAT: el RPC sync_subgroup espera claves viejas (subgroup_id) hasta retirar el shim
  // server-side; los REST calls directos ya usan groups/group_id.
  const p_subgroup = {
    id: sg.id,
    plantation_id: sg.plantacionId,
    parcela_id: sg.parcelaId,
    nombre: sg.nombre,
    codigo: sg.codigo,
    tipo: sg.tipo,
    // El server solo acepta 'activa'|'finalizada'; 'sincronizada' es un flag solo-cliente que mapea a 'finalizada'.
    estado: sg.estado === 'activa' ? 'activa' : 'finalizada',
    usuario_creador: sg.usuarioCreador,
    created_at: sg.createdAt,
  };

  // sync_subgroup no sube IDs finales (plantacion_id/global_id): los genera el server
  // (RPC generate_tree_ids, #232) y llegan por el pull.
  const p_trees = sgTrees.map((t) => ({
    id: t.id,
    subgroup_id: t.groupId,
    species_id: t.especieId ?? null,
    posicion: t.posicion,
    sub_id: t.subId,
    foto_url: photoMap.get(t.id) ?? (isRemoteUri(t.fotoUrl) ? t.fotoUrl : null),
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

export function classifyRpcResult(
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
  // DUPLICATE_CODE y PERMISSION son los códigos que sync_subgroup devuelve explícitamente
  // (unicidad por parcela / guard de membresía).
  const RPC_CODES: SyncErrorCode[] = ['DUPLICATE_CODE', 'PERMISSION'];
  const errorCode: SyncErrorCode = RPC_CODES.includes(data?.error) ? data.error : 'UNKNOWN';
  return { success: false, groupId: sg.id, nombre: sg.nombre, error: errorCode };
}

// ─── Parcela-ready gate for groups ──────────────────────

/** Un grupo solo se sube si su parcela está sync-ready (sin cambios pendientes, no tombstoned); si no, se reporta PARCELA_PENDING (#90). */
async function isParcelaSyncReady(parcelaId: string): Promise<boolean> {
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

    if (!(await isParcelaSyncReady(sg.parcelaId))) {
      syncLog.info(`Skipping group "${sg.nombre}" (${sg.id}) — parcela ${sg.parcelaId} pending`);
      results.push({
        success: false,
        groupId: sg.id,
        nombre: sg.nombre,
        error: 'PARCELA_PENDING',
        parcelaId: sg.parcelaId,
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
