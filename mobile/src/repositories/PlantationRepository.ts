/**
 * PlantationRepository — all admin mutation functions for plantation management.
 *
 * All server mutations (create, finalize, save species, assign technicians) write
 * to Supabase first, then sync back to local SQLite + call notifyDataChanged().
 *
 * Los IDs finales (plantacion_id/global_id) los genera la web de gestión
 * server-side (RPC generate_tree_ids, issue #232); la app los recibe por pull.
 *
 * Covers: PLAN-01, PLAN-02, PLAN-03, PLAN-05, PLAN-06
 */
import { supabase } from '../supabase/client';
import { db } from '../database/client';
import { plantations, parcelas, trees, groups, plantationSpecies, plantationUsers, userSpeciesOrder } from '../database/schema';
import { eq, sql } from 'drizzle-orm';
import { notifyDataChanged } from '../database/liveQuery';
import { pullFromServer } from '../services/SyncService';
import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';

// ─── createPlantation ─────────────────────────────────────────────────────────

/**
 * PLAN-01
 * Creates a new plantation on Supabase, then upserts the returned row into
 * local SQLite so it appears immediately in the admin list.
 *
 * CRITICAL (Pitfall 2): pullFromServer does NOT pull the plantation row itself —
 * only groups/species/users. We must upsert the returned row directly.
 */
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

  // Upsert plantation row directly into local SQLite (pullFromServer won't do this)
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

  notifyDataChanged();
  return data;
}

// ─── createPlantationLocally ──────────────────────────────────────────────────

/**
 * OFPL-01
 * Creates a new plantation row in local SQLite only, with pendingSync=true.
 * No Supabase call — works fully offline.
 * Groups can immediately reference this plantation via FK because the row exists locally.
 */
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
  notifyDataChanged();
  return { id, lugar, periodo, estado: 'activa' };
}

// ─── updatePlantation ─────────────────────────────────────────────────────────

/**
 * Updates lugar, periodo y config GPS de una plantación existente.
 *
 * Online: pushea a Supabase primero, luego actualiza SQLite local + columnas
 * *Server (snapshot del último valor de server).
 * Offline: guarda local, setea pendingEdit=true y snapshotea los valores
 * originales (solo en la primera edición offline — ediciones siguientes
 * conservan el snapshot para que discard revierta al último estado de server).
 * La config GPS sigue el MISMO patrón de snapshot que lugar/periodo
 * (gpsCaptureFrequencyServer/RequiredServer), así discardPlantationEdit la revierte.
 *
 * pendingEdit solo aplica con pendingSync=false (plantación ya en server). Para
 * plantaciones creadas offline (pendingSync=true) se actualizan campos directo.
 */
export async function updatePlantation(
  plantacionId: string,
  lugar: string,
  periodo: string,
  gps?: PlantationGpsSettings
): Promise<void> {
  const gpsLocal = gps ?? {};
  // Snapshot de server tras un push exitoso (solo si se editó la config GPS).
  const gpsServerSnapshot = gps
    ? {
        gpsCaptureFrequencyServer: gps.gpsCaptureFrequency,
        gpsCaptureRequiredServer: gps.gpsCaptureRequired,
      }
    : {};
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

  // For offline-created plantations, just update local fields
  if (row.pendingSync) {
    await db
      .update(plantations)
      .set({ lugar, periodo, ...gpsLocal })
      .where(eq(plantations.id, plantacionId));
    notifyDataChanged();
    return;
  }

  // Try online update
  const net = await NetInfo.fetch();
  if (net.isConnected !== false) {
    try {
      const { error } = await supabase
        .from('plantations')
        .update({ lugar, periodo, ...gpsToRemoteColumns(gps) })
        .eq('id', plantacionId);
      if (error) throw error;

      // Success: update local + server columns, clear pendingEdit
      await db
        .update(plantations)
        .set({
          lugar,
          periodo,
          lugarServer: lugar,
          periodoServer: periodo,
          pendingEdit: false,
          ...gpsLocal,
          ...gpsServerSnapshot,
        })
        .where(eq(plantations.id, plantacionId));
      notifyDataChanged();
      return;
    } catch (e: any) {
      // Network error → fall through to offline path
      if (!e?.message?.includes('Network request failed')) throw e;
    }
  }

  // Offline path: save locally + snapshot originals on first edit
  const isFirstOfflineEdit = !row.pendingEdit;
  await db
    .update(plantations)
    .set({
      lugar,
      periodo,
      ...gpsLocal,
      pendingEdit: true,
      // Only snapshot server values on first offline edit
      ...(isFirstOfflineEdit
        ? {
            lugarServer: row.lugarServer ?? row.lugarCurrent,
            periodoServer: row.periodoServer ?? row.periodoCurrent,
            gpsCaptureFrequencyServer: row.gpsFreqServer ?? row.gpsFreqCurrent,
            gpsCaptureRequiredServer: row.gpsReqServer ?? row.gpsReqCurrent,
          }
        : {}),
    })
    .where(eq(plantations.id, plantacionId));
  notifyDataChanged();
}

// ─── discardPlantationEdit ───────────────────────────────────────────────────

/**
 * Reverts a pending offline edit: restores lugar/periodo y la config GPS desde
 * las columnas *Server y limpia pendingEdit. Funciona 100% offline — sin red.
 */
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
      // Revertir la config GPS solo si hay snapshot (plantaciones editadas antes
      // de existir las columnas 0016 no lo tienen → se dejan como están).
      ...(row.gpsFreqServer !== null ? { gpsCaptureFrequency: row.gpsFreqServer } : {}),
      ...(row.gpsReqServer !== null ? { gpsCaptureRequired: row.gpsReqServer } : {}),
    })
    .where(eq(plantations.id, plantacionId));
  notifyDataChanged();
}

// ─── finalizePlantation ───────────────────────────────────────────────────────

/**
 * PLAN-06
 * Updates plantation estado to 'finalizada' on Supabase AND local SQLite.
 *
 * CRITICAL (Pitfall 6): Must update BOTH server AND local. Server update
 * propagates to other devices; local update keeps UI reactive immediately.
 */
export async function finalizePlantation(plantacionId: string): Promise<void> {
  // 1. Update on Supabase
  const { error } = await supabase
    .from('plantations')
    .update({ estado: 'finalizada' })
    .eq('id', plantacionId);

  if (error) throw error;

  // 2. Update local SQLite
  await db
    .update(plantations)
    .set({ estado: 'finalizada' })
    .where(eq(plantations.id, plantacionId));

  notifyDataChanged();
}

// ─── saveSpeciesConfig ────────────────────────────────────────────────────────

/**
 * PLAN-02 / PLAN-04 / PLAN-05
 * Atomically replaces all species for a plantation:
 * 1. DELETE all existing plantation_species on Supabase
 * 2. INSERT the new items array on Supabase
 * 3. pullFromServer to sync back to local SQLite
 * 4. notifyDataChanged for reactive UI
 */
export async function saveSpeciesConfig(
  plantacionId: string,
  items: Array<{ especieId: string; ordenVisual: number }>
): Promise<void> {
  // Delete all existing species for this plantation
  const { error: deleteError } = await supabase
    .from('plantation_species')
    .delete()
    .eq('plantation_id', plantacionId);

  if (deleteError) throw deleteError;

  // Insert new items if any
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

  // Sync back to local SQLite (pullFromServer handles plantation_species upsert)
  await pullFromServer(plantacionId);
  notifyDataChanged();
}

// ─── saveSpeciesConfigLocally ─────────────────────────────────────────────────

/**
 * OFPL-02
 * Writes plantation_species rows to local SQLite only — no Supabase call.
 * Replaces all existing species for the plantation atomically.
 * Used for offline plantation species configuration.
 */
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

/**
 * PLAN-03
 * Atomically replaces all technician assignments for a plantation:
 * 1. DELETE all existing plantation_users on Supabase
 * 2. INSERT new user rows on Supabase
 * 3. pullFromServer to sync back to local SQLite
 * 4. notifyDataChanged for reactive UI
 */
export async function assignTechnicians(
  plantacionId: string,
  userIds: string[]
): Promise<void> {
  // Delete all existing user assignments
  const { error: deleteError, count: deleteCount } = await supabase
    .from('plantation_users')
    .delete()
    .eq('plantation_id', plantacionId);

  console.log(`[Admin] Deleted ${deleteCount ?? '?'} plantation_users for ${plantacionId}`, deleteError ? `ERROR: ${deleteError.message}` : 'OK');
  if (deleteError) throw deleteError;

  // Insert new assignments
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

  // Sync back to local SQLite
  await pullFromServer(plantacionId);
  notifyDataChanged();
}

// --- deletePlantationLocally ------------------------------------------------

/**
 * Removes a plantation and ALL related data from local SQLite.
 * Server data (Supabase) is NOT affected.
 *
 * Deletion order (manual cascade — SQLite does not enforce FK cascades):
 * 1. trees (via subgroup IDs)
 * 2. groups
 * 3. parcelas (#90: antes no se borraban y quedaban filas huérfanas)
 * 4. plantation_species
 * 5. plantation_users
 * 6. user_species_order
 * 7. plantations
 *
 * Wrapped in db.transaction() for atomicity.
 */
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
