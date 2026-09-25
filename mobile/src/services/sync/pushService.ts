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
  puedeEditarParcelas,
  Parcela,
} from '../../repositories/ParcelaRepository';
import { markPhotoSynced } from '../../repositories/TreeRepository';
import {
  SYNC_ERROR, SyncErrorCode, SyncGroupResult, SyncParcelaResult, SyncProgress,
  PhotoSyncProgress, classifyServerError,
} from './types';
import { PG_ERROR } from '../../supabase/postgresErrorCodes';
import { uploadPhotoToStorage } from './storageUpload';
import { conLimiteDeConcurrencia, FOTOS_EN_PARALELO } from './concurrencia';
import { borradosDePlantacion, limpiarBorrados, type BorradoPendiente } from '../../repositories/BorradosRepository';
import { ENTIDADES_DE_FILA, FOTOS_QUITADAS, type EntidadBorrada } from '../../constants/entidadBorrada';
import { abortarSiCancelado, relanzarSiEsCancelacion } from './cancelacion';
import { esTimeout } from '../../supabase/fetchConTimeout';
import { getPlantationEstadoDeEdicion } from '../../queries/adminQueries';
import { esArchivada } from '../../constants/estados';
import { plantacionEsEditable, type EstadoDeEdicionDePlantacion } from '../../utils/permisosDeEdicion';

// Supabase 23505 (unique violation): `details` = 'Key (cols)=(vals) already exists' — classifyParcelaRpcResult parsea details, nunca message (no estable entre locales/versiones de postgres). Fallback: GENERIC_CONFLICT.

// ─── Upload Parcela (antes que groups por FK) ────────────

/**
 * Upsert de parcela (activa o tombstoned): el mismo path sube deletedAt y Supabase aplica el cambio.
 * Sin permiso de edición (técnico, #640) solo se suben altas: `ON CONFLICT DO NOTHING` descarta la
 * edición pendiente de una parcela que ya existe y el pull trae la del server, en vez de quedar
 * trabada en un 42501 para siempre. También hace idempotente reintentar un alta ya subida.
 */
async function uploadParcela(parcela: Parcela, soloAltas: boolean): Promise<{ data: any; error: any }> {
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
      { onConflict: 'id', ignoreDuplicates: soloAltas }
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
      return { success: false, parcelaId: parcela.id, nombre: parcela.nombre, error: SYNC_ERROR.GENERIC_CONFLICT };
    }
    const match = details.match(/Key \(([^)]+)\)=/);
    if (!match) {
      return { success: false, parcelaId: parcela.id, nombre: parcela.nombre, error: SYNC_ERROR.GENERIC_CONFLICT };
    }
    const cols = match[1].split(',').map(c => c.trim().toLowerCase());
    if (cols.includes('codigo')) {
      return { success: false, parcelaId: parcela.id, nombre: parcela.nombre, error: SYNC_ERROR.DUPLICATE_CODE };
    }
    if (cols.includes('nombre')) {
      return { success: false, parcelaId: parcela.id, nombre: parcela.nombre, error: SYNC_ERROR.DUPLICATE_NAME };
    }
    return { success: false, parcelaId: parcela.id, nombre: parcela.nombre, error: SYNC_ERROR.GENERIC_CONFLICT };
  }

  // Sin conflicto de unicidad: detail lleva el código postgres crudo para diagnosticar.
  const { error: code, detail } = classifyServerError(error);
  return { success: false, parcelaId: parcela.id, nombre: parcela.nombre, error: code, detail };
}

/** Por qué la plantación no admite escrituras, con la misma prioridad que `motivo_no_escribible` del server. */
export function motivoDeBloqueo(plantacion: EstadoDeEdicionDePlantacion | null): SyncErrorCode | null {
  if (plantacion == null) return null;
  if (esArchivada(plantacion)) return SYNC_ERROR.PLANTACION_ARCHIVADA;
  if (!plantacionEsEditable(plantacion)) return SYNC_ERROR.PLANTACION_FINALIZADA;
  return null;
}

/**
 * El upsert va por PostgREST, no por un RPC: RLS rechaza igual con 42501 a quien no es
 * miembro y a una plantación finalizada o archivada (#511). El estado local, que el pull
 * acaba de refrescar, distingue los dos casos.
 */
async function desempatarPermiso(result: SyncParcelaResult, plantacionId: string): Promise<SyncParcelaResult> {
  if (result.success || result.error !== SYNC_ERROR.PERMISSION) return result;
  const motivo = motivoDeBloqueo(await getPlantationEstadoDeEdicion(plantacionId));
  if (motivo == null) return result;
  // Sin `detail`: el 42501 crudo contradice el mensaje, igual que en los grupos rechazados.
  return { success: false, parcelaId: result.parcelaId, nombre: result.nombre, error: motivo };
}

/** Sube todas las parcelas syncable de una plantación (activas + tombstoned con pending_sync=true); solo limpia pending_sync en éxito. */
export async function uploadSyncableParcelas(
  plantacionId: string
): Promise<SyncParcelaResult[]> {
  const pending = await getSyncableParcelas(plantacionId);
  const results: SyncParcelaResult[] = [];
  if (pending.length === 0) return results;
  const soloAltas = !(await puedeEditarParcelas());

  for (const parcela of pending) {
    try {
      const { data, error } = await uploadParcela(parcela, soloAltas);
      const result = await desempatarPermiso(classifyParcelaRpcResult(parcela, data, error), plantacionId);
      if (result.success) await markParcelaSynced(parcela.id);
      // En cualquier error: NO markSynced — pending_sync queda en true.
      results.push(result);
    } catch (e: any) {
      relanzarSiEsCancelacion(e);
      syncLog.error(`Parcela upload exception "${parcela.nombre}" (${parcela.id}):`, e);
      const codigo = esTimeout(e) ? SYNC_ERROR.TIMEOUT : SYNC_ERROR.NETWORK;
      results.push({ success: false, parcelaId: parcela.id, nombre: parcela.nombre, error: codigo });
    }
  }

  return results;
}

// ─── Propagación de borrados ─────────────────────────────────────────────────

/**
 * Sube al server los borrados anotados localmente: árboles y grupos (#467) y
 * fotos quitadas (#498).
 *
 * Va por RPC y no por PostgREST: **no hay policy de DELETE sobre `trees` ni sobre
 * `groups`**, y un update que no matchea tampoco da error (#319). El RPC devuelve
 * qué rechazó, que es lo que decide qué se limpia.
 *
 * El registro se limpia SOLO con la confirmación del server. Si falla, las filas
 * quedan para el próximo intento — reaplicar un borrado es un no-op, así que
 * reintentar es seguro.
 */
export async function pushBorrados(plantacionId: string): Promise<void> {
  await pushBorradosDeFilas(plantacionId);
  await pushFotosQuitadas(plantacionId);
}

async function pushBorradosDeFilas(plantacionId: string): Promise<void> {
  const pendientes = await borradosDePlantacion(plantacionId, ENTIDADES_DE_FILA);
  if (pendientes.length === 0) return;

  // Solo id y tipo: la membresía la valida el server contra la plantación real de
  // cada fila, no contra lo que diga el payload.
  const { data, error } = await supabase.rpc('sincronizar_borrados', {
    p_borrados: pendientes.map((b) => ({ id: b.id, tipo: b.tipo })),
  });
  if (error || data?.success !== true) {
    syncLog.error('Push borrados falló:', JSON.stringify(error ?? data));
    return;
  }

  const rechazados = await limpiarConfirmados(pendientes, data.rechazados, ENTIDADES_DE_FILA);
  syncLog.info(`Push borrados: ${data.arboles} árboles, ${data.grupos} grupos`);
  if (rechazados > 0) syncLog.info(`Push borrados: ${rechazados} pendientes, ${motivosDeRechazo(data.rechazos)}`);
}

/**
 * `sync_subgroup` no puede quitar una foto: un `foto_url` null no pisa el del
 * server. Sin esto el pull la restauraba y se volvía a bajar (#498).
 */
async function pushFotosQuitadas(plantacionId: string): Promise<void> {
  const pendientes = await borradosDePlantacion(plantacionId, FOTOS_QUITADAS);
  if (pendientes.length === 0) return;

  const { data, error } = await supabase.rpc('quitar_fotos_arboles', {
    p_arboles: pendientes.map((b) => b.id),
  });
  if (error || data?.success !== true) {
    syncLog.error('Push fotos quitadas falló:', JSON.stringify(error ?? data));
    return;
  }

  const rechazadas = await limpiarConfirmados(pendientes, data.rechazados, FOTOS_QUITADAS);
  syncLog.info(`Push fotos quitadas: ${data.quitadas}`);
  if (rechazadas > 0) syncLog.info(`Push fotos quitadas: ${rechazadas} pendientes, ${motivosDeRechazo(data.rechazos)}`);
}

/**
 * Los rechazados son de una plantación no escribible (#469): quedan pendientes por
 * si se reabre. El resto se limpia aunque el server no haya tocado nada — un id
 * que ya no está no vuelve nunca. Devuelve cuántos quedaron.
 */
async function limpiarConfirmados(
  pendientes: BorradoPendiente[],
  idsRechazados: unknown,
  tipos: readonly EntidadBorrada[],
): Promise<number> {
  const rechazados = new Set<string>(Array.isArray(idsRechazados) ? idsRechazados : []);
  await limpiarBorrados(pendientes.map((b) => b.id).filter((id) => !rechazados.has(id)), tipos);
  return rechazados.size;
}

/**
 * "PLANTACION_ARCHIVADA ×2, PLANTACION_FINALIZADA ×1". `rechazos` llega desde #477:
 * un server anterior solo manda `rechazados`, y ahí el motivo era siempre finalizada.
 */
export function motivosDeRechazo(rechazos: unknown): string {
  if (!Array.isArray(rechazos)) return SYNC_ERROR.PLANTACION_FINALIZADA;
  const porMotivo = new Map<string, number>();
  for (const { error } of rechazos as { error?: string }[]) {
    const motivo = error ?? SYNC_ERROR.UNKNOWN;
    porMotivo.set(motivo, (porMotivo.get(motivo) ?? 0) + 1);
  }
  return [...porMotivo].map(([motivo, n]) => `${motivo} ×${n}`).join(', ');
}

// ─── Upload a single Group ─────────────────────────────────────────────────

type ArbolDeGrupo = {
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
};

/** Sube a Storage las fotos locales pendientes y devuelve treeId → path. No las marca: eso espera al RPC. */
async function subirFotosDelGrupo(
  sg: Group,
  sgTrees: ArbolDeGrupo[],
  onPhotoProgress?: (progress: PhotoSyncProgress) => void,
): Promise<Map<string, string>> {
  // Solo resube fotos con fotoSynced=false; las que ya están en Storage (de otro device) se saltean.
  const photoMap = new Map<string, string>();
  const pendientes = sgTrees.filter((t) => isLocalUri(t.fotoUrl) && !t.fotoSynced);
  // Sin esto el modal queda clavado en "grupo i de n" mientras se suben K fotos: es
  // el tramo más largo del sync de una plantación con fotos.
  const inicio = Date.now();
  if (pendientes.length > 0) onPhotoProgress?.({ total: pendientes.length, completed: 0, bytes: 0, desde: inicio });

  // Completadas, no índice del loop: con N fotos en vuelo el índice retrocede.
  let completadas = 0;
  let bytesSubidos = 0;
  await conLimiteDeConcurrencia(pendientes, FOTOS_EN_PARALELO, async (t) => {
    abortarSiCancelado();
    const storagePath = `plantations/${sg.plantacionId}/parcelas/${sg.parcelaId}/trees/${t.id}.jpg`;
    const { error, bytes } = await uploadPhotoToStorage(t.fotoUrl!, storagePath);
    if (!error) {
      photoMap.set(t.id, storagePath);
      bytesSubidos += bytes;
    } else {
      syncLog.error(`Photo upload failed for tree ${t.id}:`, error.message);
    }
    onPhotoProgress?.({ total: pendientes.length, completed: ++completadas, bytes: bytesSubidos, desde: inicio });
  });
  return photoMap;
}

// COMPAT: el RPC sync_subgroup espera claves viejas (subgroup_id) hasta retirar el shim
// server-side; los REST calls directos ya usan groups/group_id.
// `parcela_codigo`: el código con el que se armaron los SubID. Si ya no es el de la
// parcela en el server, el server les cambia el prefijo por el vigente (#626).
function payloadDeGrupo(sg: Group, parcelaCodigo: string) {
  return {
    id: sg.id,
    plantation_id: sg.plantacionId,
    parcela_id: sg.parcelaId,
    nombre: sg.nombre,
    codigo: sg.codigo,
    tipo: sg.tipo,
    estado: sg.estado,
    usuario_creador: sg.usuarioCreador,
    created_at: sg.createdAt,
    parcela_codigo: parcelaCodigo,
  };
}

// sync_subgroup no sube IDs finales (plantacion_id/global_id): los genera el server
// (RPC generate_tree_ids, #232) y llegan por el pull.
function payloadDeArboles(sgTrees: ArbolDeGrupo[], photoMap: Map<string, string>) {
  return sgTrees.map((t) => ({
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
}

/**
 * Sube fotos a Storage antes del RPC para que foto_url lleve el path de Storage (nunca file://).
 *
 * `fotoSynced` se marca recién con el RPC confirmado (#489): si se marcara antes y el
 * RPC fallara, el reintento saltearía la foto y mandaría foto_url null. Resubirla es
 * seguro porque el path es determinístico y la subida usa upsert.
 */
export async function uploadGroup(
  sg: Group,
  sgTrees: ArbolDeGrupo[],
  parcelaCodigo: string,
  onPhotoProgress?: (progress: PhotoSyncProgress) => void,
) {
  const photoMap = await subirFotosDelGrupo(sg, sgTrees, onPhotoProgress);
  const respuesta = await supabase.rpc('sync_subgroup', {
    p_subgroup: payloadDeGrupo(sg, parcelaCodigo),
    p_trees: payloadDeArboles(sgTrees, photoMap),
  });
  if (!respuesta.error && respuesta.data?.success === true) {
    for (const treeId of photoMap.keys()) await markPhotoSynced(treeId);
  }
  return respuesta;
}

// ─── RPC result classification (groups) ──────────────────────────────────────

export function classifyRpcResult(
  sg: Pick<Group, 'id' | 'nombre' | 'parcelaId'>,
  data: any,
  error: any
): SyncGroupResult {
  if (error) {
    syncLog.error(`RPC error for "${sg.nombre}" (${sg.id}):`, JSON.stringify(error));
    // El push de grupos es el camino dominante: sin esto el código TIMEOUT no
    // llegaría nunca a la UI por acá (#451).
    const codigo = esTimeout(error) ? SYNC_ERROR.TIMEOUT : SYNC_ERROR.NETWORK;
    return { success: false, groupId: sg.id, nombre: sg.nombre, error: codigo };
  }
  if (data?.success === true) {
    return { success: true, groupId: sg.id, nombre: sg.nombre };
  }
  syncLog.error(`RPC rejected "${sg.nombre}" (${sg.id}):`, JSON.stringify(data));
  // Los códigos que sync_subgroup devuelve explícitamente: unicidad de código y nombre por parcela (#626),
  // guard de membresía, y plantación finalizada o archivada (#469, #477).
  const RPC_CODES: SyncErrorCode[] = [
    SYNC_ERROR.DUPLICATE_CODE,
    SYNC_ERROR.DUPLICATE_NAME,
    SYNC_ERROR.PERMISSION,
    SYNC_ERROR.PLANTACION_FINALIZADA,
    SYNC_ERROR.PLANTACION_ARCHIVADA,
  ];
  const errorCode: SyncErrorCode = RPC_CODES.includes(data?.error) ? data.error : SYNC_ERROR.UNKNOWN;
  return { success: false, groupId: sg.id, nombre: sg.nombre, error: errorCode };
}

// ─── Parcela-ready gate for groups ──────────────────────

/**
 * Un grupo solo se sube si su parcela está sync-ready (sin cambios pendientes, no tombstoned); si no,
 * se reporta PARCELA_PENDING (#90). Devuelve su código, o null si no está lista.
 */
async function codigoDeParcelaLista(parcelaId: string): Promise<string | null> {
  const [row] = await db.select({ codigo: parcelasTable.codigo })
    .from(parcelasTable)
    .where(and(
      eq(parcelasTable.id, parcelaId),
      eq(parcelasTable.pendingSync, false),
      isNull(parcelasTable.deletedAt),
    ))
    .limit(1);
  return row?.codigo ?? null;
}

// ─── Upload syncable groups ───────────────────────────────────────────────

export async function uploadSyncableGroups(
  plantacionId: string,
  onProgress?: (progress: SyncProgress) => void,
  onPhotoProgress?: (progress: PhotoSyncProgress) => void,
): Promise<SyncGroupResult[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const pending = await getSyncableGroups(plantacionId, user?.id);
  const results: SyncGroupResult[] = [];

  for (let i = 0; i < pending.length; i++) {
    const sg = pending[i];
    onProgress?.({ total: pending.length, completed: i, currentName: sg.nombre });

    const parcelaCodigo = await codigoDeParcelaLista(sg.parcelaId);
    if (parcelaCodigo == null) {
      syncLog.info(`Skipping group "${sg.nombre}" (${sg.id}) — parcela ${sg.parcelaId} pending`);
      results.push({
        success: false,
        groupId: sg.id,
        nombre: sg.nombre,
        error: SYNC_ERROR.PARCELA_PENDING,
        parcelaId: sg.parcelaId,
      });
      continue;
    }

    const sgTrees = await db.select().from(trees).where(eq(trees.groupId, sg.id));
    try {
      const { data, error } = await uploadGroup(sg, sgTrees, parcelaCodigo, onPhotoProgress);
      const result = classifyRpcResult(sg, data, error);
      if (result.success) await markGroupSynced(sg.id);
      results.push(result);
    } catch (e) {
      relanzarSiEsCancelacion(e);
      syncLog.error(`Exception for "${sg.nombre}" (${sg.id}):`, e);
      const codigo = esTimeout(e) ? SYNC_ERROR.TIMEOUT : SYNC_ERROR.NETWORK;
      results.push({ success: false, groupId: sg.id, nombre: sg.nombre, error: codigo });
    }
  }

  // Cierre explícito: el emisor del loop reporta `completed: i` antes de subir el
  // grupo i, así que sin esto el contador nunca llegaba a "N de N".
  if (pending.length > 0) {
    onProgress?.({ total: pending.length, completed: pending.length, currentName: '' });
  }

  return results;
}
