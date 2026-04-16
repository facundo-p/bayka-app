import { supabase } from '../../supabase/client';
import { db } from '../../database/client';
import { plantationSpecies, plantations, species } from '../../database/schema';
import { eq, sql } from 'drizzle-orm';
import { syncLog } from '../../utils/syncLogger';

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
      syncLog.error('Upload plantation failed:', p.id, plantError.message);
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
        syncLog.error('Upload plantation_species failed:', p.id, psError.message);
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
        syncLog.error('Upload pending edit failed:', p.id, error.message);
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
      syncLog.error('Upload pending edit exception:', p.id, e?.message);
    }
  }
}

// ─── Global pre-steps ────────────────────────────────────────────────────────

export async function runGlobalPreSteps(): Promise<void> {
  await supabase.auth.getSession();
  try { await pullSpeciesFromServer(); } catch (e) { syncLog.error('Pull species failed:', e); }
  try { await uploadOfflinePlantations(); } catch (e) { syncLog.error('Upload offline plantations failed:', e); }
  try { await uploadPendingEdits(); } catch (e) { syncLog.error('Upload pending edits failed:', e); }
}
