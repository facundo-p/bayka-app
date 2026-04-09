/**
 * PlantationRepository — all admin mutation functions for plantation management.
 *
 * All server mutations (create, finalize, save species, assign technicians) write
 * to Supabase first, then sync back to local SQLite + call notifyDataChanged().
 * ID generation is a local-only SQLite transaction.
 *
 * Covers: PLAN-01, PLAN-02, PLAN-03, PLAN-05, PLAN-06, IDGN-02, IDGN-03
 */
import { supabase } from '../supabase/client';
import { db } from '../database/client';
import { plantations, trees, subgroups, plantationSpecies, plantationUsers, userSpeciesOrder } from '../database/schema';
import { eq, asc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
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
 * only subgroups/species/users. We must upsert the returned row directly.
 */
export async function createPlantation(
  lugar: string,
  periodo: string,
  organizacionId: string,
  creadoPor: string
): Promise<{ id: string; lugar: string; periodo: string; estado: string }> {
  const { data, error } = await supabase
    .from('plantations')
    .insert({
      lugar,
      periodo,
      organizacion_id: organizacionId,
      creado_por: creadoPor,
      estado: 'activa',
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
 * Subgroups can immediately reference this plantation via FK because the row exists locally.
 */
export async function createPlantationLocally(
  lugar: string,
  periodo: string,
  organizacionId: string,
  creadoPor: string
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
  });
  notifyDataChanged();
  return { id, lugar, periodo, estado: 'activa' };
}

// ─── updatePlantation ─────────────────────────────────────────────────────────

/**
 * Updates lugar and periodo for an existing plantation.
 *
 * Online: pushes to Supabase first, then updates local SQLite + server columns.
 * Offline: saves locally only, sets pendingEdit=true, and snapshots original
 * server values (only on first offline edit — subsequent edits keep the original
 * snapshot so discard always reverts to the last-known server state).
 *
 * pendingEdit is only meaningful when pendingSync=false (plantation already exists
 * on server). For offline-created plantations (pendingSync=true), we just update
 * the local fields directly.
 */
export async function updatePlantation(
  plantacionId: string,
  lugar: string,
  periodo: string
): Promise<void> {
  // Check if this is an offline-created plantation (not yet on server)
  const [row] = await db
    .select({
      pendingSync: plantations.pendingSync,
      pendingEdit: plantations.pendingEdit,
      lugarServer: plantations.lugarServer,
      periodoServer: plantations.periodoServer,
      lugarCurrent: plantations.lugar,
      periodoCurrent: plantations.periodo,
    })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));

  if (!row) throw new Error('Plantación no encontrada');

  // For offline-created plantations, just update local fields
  if (row.pendingSync) {
    await db
      .update(plantations)
      .set({ lugar, periodo })
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
        .update({ lugar, periodo })
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
      pendingEdit: true,
      // Only snapshot server values on first offline edit
      ...(isFirstOfflineEdit
        ? {
            lugarServer: row.lugarServer ?? row.lugarCurrent,
            periodoServer: row.periodoServer ?? row.periodoCurrent,
          }
        : {}),
    })
    .where(eq(plantations.id, plantacionId));
  notifyDataChanged();
}

// ─── discardPlantationEdit ───────────────────────────────────────────────────

/**
 * Reverts a pending offline edit: restores lugar/periodo from *Server columns
 * and clears pendingEdit. Works fully offline — no network required.
 */
export async function discardPlantationEdit(plantacionId: string): Promise<void> {
  const [row] = await db
    .select({
      lugarServer: plantations.lugarServer,
      periodoServer: plantations.periodoServer,
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

// ─── generateIds ─────────────────────────────────────────────────────────────

/**
 * IDGN-02 / IDGN-03
 * Assigns sequential IDs to all trees in a plantation:
 * - plantacionId: 1..N (sequential within plantation)
 * - globalId: seed..(seed + N - 1) (sequential across org)
 *
 * Order is deterministic: subgroups.createdAt ASC, trees.posicion ASC.
 * Uses a db.transaction() to ensure atomicity.
 *
 * CRITICAL (Pitfall 3): ORDER BY must be deterministic — subgroups.createdAt ASC,
 * trees.posicion ASC. Both are immutable after sync.
 */
export async function generateIds(plantacionId: string, seed: number): Promise<void> {
  // 1. Fetch all trees ordered deterministically
  const orderedTrees = await db
    .select({ treeId: trees.id })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .where(eq(subgroups.plantacionId, plantacionId))
    .orderBy(asc(subgroups.createdAt), asc(trees.posicion));

  // 2. Assign IDs in a transaction for atomicity
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedTrees.length; i++) {
      await tx
        .update(trees)
        .set({ plantacionId: i + 1, globalId: seed + i })
        .where(eq(trees.id, orderedTrees[i].treeId));
    }
  });

  notifyDataChanged();
}

// --- deletePlantationLocally ------------------------------------------------

/**
 * Removes a plantation and ALL related data from local SQLite.
 * Server data (Supabase) is NOT affected.
 *
 * Deletion order (manual cascade — SQLite does not enforce FK cascades):
 * 1. trees (via subgroup IDs)
 * 2. subgroups
 * 3. plantation_species
 * 4. plantation_users
 * 5. user_species_order
 * 6. plantations
 *
 * Wrapped in db.transaction() for atomicity.
 */
export async function deletePlantationLocally(plantacionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(trees).where(
      sql`${trees.subgrupoId} IN (SELECT id FROM subgroups WHERE plantacion_id = ${plantacionId})`
    );
    await tx.delete(subgroups).where(eq(subgroups.plantacionId, plantacionId));
    await tx.delete(plantationSpecies).where(eq(plantationSpecies.plantacionId, plantacionId));
    await tx.delete(plantationUsers).where(eq(plantationUsers.plantationId, plantacionId));
    await tx.delete(userSpeciesOrder).where(eq(userSpeciesOrder.plantacionId, plantacionId));
    await tx.delete(plantations).where(eq(plantations.id, plantacionId));
  });
  notifyDataChanged();
}
