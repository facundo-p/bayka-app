/**
 * PlantationRepository — mutaciones admin: escriben a Supabase primero, sincronizan a SQLite después.
 * IDs finales (plantacion_id/global_id) los genera el server (RPC generate_tree_ids, #232) y llegan vía pull.
 */
import { supabase } from '../supabase/client';
import { db } from '../database/client';
import { plantations, parcelas, trees, groups, plantationSpecies, plantationUsers, userSpeciesOrder } from '../database/schema';
import { eq, sql } from 'drizzle-orm';
import { notifyDataChanged } from '../database/liveQuery';
import { pullFromServer } from '../services/SyncService';
import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { isNetworkRequestFailed } from '../utils/networkErrors';
import { syncLog } from '../utils/syncLogger';

// ─── Membresía local del creador ─────────────────────────────────────────────

/** Inserta localmente la membresía admin del creador (#67); el server la completa vía trigger, pero esta fila da consistencia inmediata offline hasta el próximo pull. */
async function upsertLocalAdminMembership(plantacionId: string, userId: string): Promise<void> {
  await db
    .insert(plantationUsers)
    .values({
      plantationId: plantacionId,
      userId,
      rolEnPlantacion: 'admin',
      assignedAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
}

// ─── createPlantation ─────────────────────────────────────────────────────────

/** Crea la plantación en Supabase y upsertea la fila en SQLite local: pullFromServer no trae la fila de plantation en sí (solo groups/species/users). */
/** Config GPS por plantación que el admin puede definir en el form. */
export interface PlantationGpsSettings {
  gpsCaptureFrequency: number;
  gpsCaptureRequired: boolean;
}

/** Mapea la config GPS a las columnas del server; vacío si no se pasó. */
function gpsToRemoteColumns(gps?: PlantationGpsSettings) {
  if (!gps) return {};
  return {
    gps_capture_frequency: gps.gpsCaptureFrequency,
    gps_capture_required: gps.gpsCaptureRequired,
  };
}

export async function createPlantation(
  lugar: string,
  periodo: string,
  organizacionId: string,
  creadoPor: string,
  gps?: PlantationGpsSettings
): Promise<{ id: string; lugar: string; periodo: string; estado: string }> {
  const { data, error } = await supabase
    .from('plantations')
    .insert({
      lugar,
      periodo,
      organizacion_id: organizacionId,
      creado_por: creadoPor,
      estado: 'activa',
      ...gpsToRemoteColumns(gps),
    })
    .select()
    .single();

  if (error) throw error;

  await db
    .insert(plantations)
    .values({
      id: data.id,
      organizacionId: data.organizacion_id,
      lugar: data.lugar,
      periodo: data.periodo,
      estado: data.estado,
      creadoPor: data.creado_por,
      createdAt: data.created_at,
      pendingSync: false,
      lugarServer: data.lugar,
      periodoServer: data.periodo,
      ...(gps ?? {}),
    })
    .onConflictDoUpdate({
      target: plantations.id,
      set: { estado: sql`excluded.estado` },
    });

  await upsertLocalAdminMembership(data.id, creadoPor);
  notifyDataChanged();
  return data;
}

// ─── createPlantationLocally ──────────────────────────────────────────────────

/** Crea la plantación solo en SQLite local (pendingSync=true, sin llamar a Supabase) — los grupos pueden referenciarla por FK de inmediato. */
export async function createPlantationLocally(
  lugar: string,
  periodo: string,
  organizacionId: string,
  creadoPor: string,
  gps?: PlantationGpsSettings
): Promise<{ id: string; lugar: string; periodo: string; estado: string }> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(plantations).values({
    id,
    organizacionId,
    lugar,
    periodo,
    estado: 'activa',
    creadoPor,
    createdAt: now,
    pendingSync: true,
    ...(gps ?? {}),
  });
  await upsertLocalAdminMembership(id, creadoPor);
  notifyDataChanged();
  return { id, lugar, periodo, estado: 'activa' };
}

// ─── updatePlantation ─────────────────────────────────────────────────────────

/** Fila mínima necesaria para decidir el camino online/offline y armar el snapshot de server. */
type CurrentPlantationRow = {
  pendingSync: boolean;
  pendingEdit: boolean;
  lugarServer: string | null;
  periodoServer: string | null;
  lugarCurrent: string;
  periodoCurrent: string;
  gpsFreqServer: number | null;
  gpsReqServer: boolean | null;
  gpsFreqCurrent: number | null;
  gpsReqCurrent: boolean | null;
};

/** Lee el estado actual de la plantación necesario para decidir cómo aplicar la edición. */
async function resolveCurrentPlantationRow(plantacionId: string): Promise<CurrentPlantationRow> {
  const [row] = await db
    .select({
      pendingSync: plantations.pendingSync,
      pendingEdit: plantations.pendingEdit,
      lugarServer: plantations.lugarServer,
      periodoServer: plantations.periodoServer,
      lugarCurrent: plantations.lugar,
      periodoCurrent: plantations.periodo,
      gpsFreqServer: plantations.gpsCaptureFrequencyServer,
      gpsReqServer: plantations.gpsCaptureRequiredServer,
      gpsFreqCurrent: plantations.gpsCaptureFrequency,
      gpsReqCurrent: plantations.gpsCaptureRequired,
    })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));

  if (!row) throw new Error('Plantación no encontrada');
  return row;
}

/** Plantación creada offline (aún sin fila en el server): edita el local sin pendingEdit ni snapshot. */
async function updateOfflineCreatedPlantation(
  plantacionId: string,
  lugar: string,
  periodo: string,
  gpsLocal: Partial<PlantationGpsSettings>
): Promise<void> {
  await db
    .update(plantations)
    .set({ lugar, periodo, ...gpsLocal })
    .where(eq(plantations.id, plantacionId));
}

/** Snapshot de las columnas *Server tras un push exitoso (solo si se editó la config GPS). */
function buildGpsServerSnapshot(gps?: PlantationGpsSettings) {
  return gps
    ? {
        gpsCaptureFrequencyServer: gps.gpsCaptureFrequency,
        gpsCaptureRequiredServer: gps.gpsCaptureRequired,
      }
    : {};
}

/**
 * Intenta pushear la edición a Supabase y, si sale bien, sincroniza las columnas *Server local.
 * Devuelve false (sin tocar nada más) ante una falla de red, para que el caller caiga al camino
 * offline; cualquier otro error del server se propaga tal cual.
 */
async function tryPushPlantationUpdateOnline(
  plantacionId: string,
  lugar: string,
  periodo: string,
  gps: PlantationGpsSettings | undefined,
  gpsLocal: Partial<PlantationGpsSettings>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('plantations')
      .update({ lugar, periodo, ...gpsToRemoteColumns(gps) })
      .eq('id', plantacionId);
    if (error) throw error;

    await db
      .update(plantations)
      .set({
        lugar,
        periodo,
        lugarServer: lugar,
        periodoServer: periodo,
        pendingEdit: false,
        ...gpsLocal,
        ...buildGpsServerSnapshot(gps),
      })
      .where(eq(plantations.id, plantacionId));
    return true;
  } catch (e: any) {
    if (!isNetworkRequestFailed(e)) throw e;
    return false;
  }
}

/** Snapshot de server SOLO en la primera edición offline, para que discardPlantationEdit revierta al último valor confirmado. */
function buildOfflineEditSnapshot(row: CurrentPlantationRow, isFirstOfflineEdit: boolean) {
  if (!isFirstOfflineEdit) return {};
  return {
    lugarServer: row.lugarServer ?? row.lugarCurrent,
    periodoServer: row.periodoServer ?? row.periodoCurrent,
    gpsCaptureFrequencyServer: row.gpsFreqServer ?? row.gpsFreqCurrent,
    gpsCaptureRequiredServer: row.gpsReqServer ?? row.gpsReqCurrent,
  };
}

/** Guarda la edición local con pendingEdit=true (sin red disponible, o tras una falla de red del push). */
async function applyOfflineEdit(
  plantacionId: string,
  lugar: string,
  periodo: string,
  gpsLocal: Partial<PlantationGpsSettings>,
  row: CurrentPlantationRow
): Promise<void> {
  const isFirstOfflineEdit = !row.pendingEdit;
  await db
    .update(plantations)
    .set({
      lugar,
      periodo,
      ...gpsLocal,
      pendingEdit: true,
      ...buildOfflineEditSnapshot(row, isFirstOfflineEdit),
    })
    .where(eq(plantations.id, plantacionId));
}

/**
 * Actualiza lugar/periodo/GPS: online pushea a Supabase y sincroniza las columnas *Server; offline
 * guarda local con pendingEdit=true, snapshoteando el valor original SOLO la primera vez (para que
 * discardPlantationEdit revierta al último server). No aplica a plantaciones creadas offline.
 */
export async function updatePlantation(
  plantacionId: string,
  lugar: string,
  periodo: string,
  gps?: PlantationGpsSettings
): Promise<void> {
  const gpsLocal = gps ?? {};
  const row = await resolveCurrentPlantationRow(plantacionId);

  if (row.pendingSync) {
    await updateOfflineCreatedPlantation(plantacionId, lugar, periodo, gpsLocal);
    notifyDataChanged();
    return;
  }

  const net = await NetInfo.fetch();
  if (net.isConnected !== false) {
    const pushed = await tryPushPlantationUpdateOnline(plantacionId, lugar, periodo, gps, gpsLocal);
    if (pushed) {
      notifyDataChanged();
      return;
    }
  }

  await applyOfflineEdit(plantacionId, lugar, periodo, gpsLocal, row);
  notifyDataChanged();
}

// ─── discardPlantationEdit ───────────────────────────────────────────────────

/** Revierte una edición offline pendiente: restaura lugar/periodo/GPS desde las columnas *Server y limpia pendingEdit. Funciona sin red. */
export async function discardPlantationEdit(plantacionId: string): Promise<void> {
  const [row] = await db
    .select({
      lugarServer: plantations.lugarServer,
      periodoServer: plantations.periodoServer,
      gpsFreqServer: plantations.gpsCaptureFrequencyServer,
      gpsReqServer: plantations.gpsCaptureRequiredServer,
    })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));

  if (!row || !row.lugarServer || !row.periodoServer) {
    throw new Error('No hay datos del servidor para restaurar');
  }

  await db
    .update(plantations)
    .set({
      lugar: row.lugarServer,
      periodo: row.periodoServer,
      pendingEdit: false,
      // Solo revertir GPS si hay snapshot: plantaciones editadas antes de esas columnas no lo tienen.
      ...(row.gpsFreqServer !== null ? { gpsCaptureFrequency: row.gpsFreqServer } : {}),
      ...(row.gpsReqServer !== null ? { gpsCaptureRequired: row.gpsReqServer } : {}),
    })
    .where(eq(plantations.id, plantacionId));
  notifyDataChanged();
}

// ─── finalizePlantation ───────────────────────────────────────────────────────

/**
 * Thrown by finalizePlantation when Supabase committed 'finalizada' but the local SQLite mirror
 * failed to update: the finalize IS effective server-side, solo el device local quedó desfasado
 * (el próximo pullFromServer lo reconcilia). Distingue este caso de un fallo real de finalización.
 */
export class FinalizePlantationLocalSyncError extends Error {
  constructor(cause: unknown) {
    super('La plantación se finalizó en el servidor, pero no se pudo reflejar localmente');
    this.name = 'FinalizePlantationLocalSyncError';
    this.cause = cause;
  }
}

/** Marca la plantación 'finalizada' en Supabase Y en SQLite local: el update de server propaga a otros devices, el local mantiene la UI reactiva sin esperar el pull. */
export async function finalizePlantation(plantacionId: string): Promise<void> {
  const { error } = await supabase
    .from('plantations')
    .update({ estado: 'finalizada' })
    .eq('id', plantacionId);

  if (error) throw error;

  try {
    await db
      .update(plantations)
      .set({ estado: 'finalizada' })
      .where(eq(plantations.id, plantacionId));
  } catch (e) {
    syncLog.error(`finalizePlantation: update local falló tras éxito en server para ${plantacionId}`, e);
    throw new FinalizePlantationLocalSyncError(e);
  }

  notifyDataChanged();
}

// ─── saveSpeciesConfig ────────────────────────────────────────────────────────

/** Reemplaza atómicamente el species config de la plantación en Supabase y sincroniza a SQLite vía pullFromServer. */
export async function saveSpeciesConfig(
  plantacionId: string,
  items: Array<{ especieId: string; ordenVisual: number }>
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('plantation_species')
    .delete()
    .eq('plantation_id', plantacionId);

  if (deleteError) throw deleteError;

  if (items.length > 0) {
    const { error: insertError } = await supabase
      .from('plantation_species')
      .insert(
        items.map((item) => ({
          plantation_id: plantacionId,
          species_id: item.especieId,
          orden_visual: item.ordenVisual,
        }))
      );

    if (insertError) throw insertError;
  }

  await pullFromServer(plantacionId);
  notifyDataChanged();
}

// ─── saveSpeciesConfigLocally ─────────────────────────────────────────────────

/** Reemplaza atómicamente el species config solo en SQLite local (sin Supabase) — para configuración offline. */
export async function saveSpeciesConfigLocally(
  plantacionId: string,
  items: Array<{ especieId: string; ordenVisual: number }>
): Promise<void> {
  await db.delete(plantationSpecies).where(eq(plantationSpecies.plantacionId, plantacionId));
  if (items.length > 0) {
    await db.insert(plantationSpecies).values(
      items.map((item) => ({
        id: `ps-${plantacionId}-${item.especieId}`,
        plantacionId,
        especieId: item.especieId,
        ordenVisual: item.ordenVisual,
      }))
    );
  }
  notifyDataChanged();
}

// ─── assignTechnicians ────────────────────────────────────────────────────────

/** Reemplaza las asignaciones de técnicos (filtra por rol_en_plantacion='tecnico' para no borrar membresías admin, #67) y sincroniza vía pullFromServer. */
export async function assignTechnicians(
  plantacionId: string,
  userIds: string[]
): Promise<void> {
  const { error: deleteError, count: deleteCount } = await supabase
    .from('plantation_users')
    .delete()
    .eq('plantation_id', plantacionId)
    .eq('rol_en_plantacion', 'tecnico');

  console.log(`[Admin] Deleted ${deleteCount ?? '?'} plantation_users for ${plantacionId}`, deleteError ? `ERROR: ${deleteError.message}` : 'OK');
  if (deleteError) throw deleteError;

  if (userIds.length > 0) {
    const now = new Date().toISOString();
    const { error: insertError } = await supabase
      .from('plantation_users')
      .insert(
        userIds.map((userId) => ({
          plantation_id: plantacionId,
          user_id: userId,
          rol_en_plantacion: 'tecnico',
          assigned_at: now,
        }))
      );

    if (insertError) throw insertError;
  }

  await pullFromServer(plantacionId);
  notifyDataChanged();
}

// --- deletePlantationLocally ------------------------------------------------

/** Borra la plantación y su data relacionada SOLO en SQLite (Supabase no se toca); orden manual porque SQLite no encadena FKs, incluye parcelas para evitar huérfanas (#90). Todo en una transacción. */
export async function deletePlantationLocally(plantacionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(trees).where(
      sql`${trees.groupId} IN (SELECT id FROM groups WHERE plantacion_id = ${plantacionId})`
    );
    await tx.delete(groups).where(eq(groups.plantacionId, plantacionId));
    await tx.delete(parcelas).where(eq(parcelas.plantacionId, plantacionId));
    await tx.delete(plantationSpecies).where(eq(plantationSpecies.plantacionId, plantacionId));
    await tx.delete(plantationUsers).where(eq(plantationUsers.plantationId, plantacionId));
    await tx.delete(userSpeciesOrder).where(eq(userSpeciesOrder.plantacionId, plantacionId));
    await tx.delete(plantations).where(eq(plantations.id, plantacionId));
  });
  notifyDataChanged();
}
