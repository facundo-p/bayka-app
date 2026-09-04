import { supabase } from '../../supabase/client';
import { db } from '../../database/client';
import {
  plantationSpecies,
  plantations,
  species,
  trees,
  userSpeciesOrder,
} from '../../database/schema';
import { and, eq, ne, sql } from 'drizzle-orm';
import { syncLog } from '../../utils/syncLogger';
import { fetchAllRows, runInTransaction } from './paginate';
import { SyncPlantationResult, classifyServerError, rawErrorDetail } from './types';
import { PG_ERROR } from '../../supabase/postgresErrorCodes';

// ─── Pull species catalog from server ────────────────────────────────────────

/** Fila de especie del server, normalizada a los nombres del schema local. */
type ServerSpecies = { id: string; codigo: string; nombre: string; nombre_cientifico?: string | null; created_at: string };

/** Ejecutor drizzle: el cliente `db` o una transacción `tx`. */
type DbExecutor = Pick<typeof db, 'insert' | 'update' | 'delete' | 'select'>;

/** Upsert de especie del server por `id` (clave estable entre devices); actualiza codigo/nombre/cientifico en conflicto. */
async function upsertSpeciesById(exec: DbExecutor, s: ServerSpecies): Promise<void> {
  await exec.insert(species).values({
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

/**
 * Reconcilia una colisión UNIQUE(codigo): el server trae una especie con `id` distinto al de una fila
 * local que ya usa ese `codigo`. Re-apunta todas las referencias del id local duplicado al id del
 * server y borra la fila duplicada, en una transacción atómica. El `codigo` se preserva, así que los
 * SubID (que lo embeben, no el id) siguen siendo válidos.
 * @returns true si reconcilió; false si no había duplicado (el error era otro y debe propagarse).
 */
async function reconcileSpeciesCodigoCollision(s: ServerSpecies): Promise<boolean> {
  return runInTransaction(db, async (tx) => {
    const [dup] = await tx
      .select({ id: species.id })
      .from(species)
      .where(and(eq(species.codigo, s.codigo), ne(species.id, s.id)));
    if (!dup) return false;

    await tx.update(trees).set({ especieId: s.id }).where(eq(trees.especieId, dup.id));
    await tx.update(trees).set({ conflictEspecieId: s.id }).where(eq(trees.conflictEspecieId, dup.id));
    await tx.update(plantationSpecies).set({ especieId: s.id }).where(eq(plantationSpecies.especieId, dup.id));
    // user_species_order tiene UNIQUE(user, plantacion, especie): re-apuntar podría colisionar; es
    // solo orden visual, se borra la referencia vieja.
    await tx.delete(userSpeciesOrder).where(eq(userSpeciesOrder.especieId, dup.id));

    await tx.delete(species).where(eq(species.id, dup.id));
    await upsertSpeciesById(tx, s);
    return true;
  });
}

/** Trae especies de Supabase y las upsertea en SQLite; si falla, retorna en silencio (catálogo stale es aceptable). Solo borra una especie al reconciliar un duplicado por codigo, tras re-apuntar sus referencias. */
export async function pullSpeciesFromServer(): Promise<void> {
  const { data, error } = await fetchAllRows<ServerSpecies>(() =>
    supabase.from('species').select('*')
  );
  if (error || !data) {
    syncLog.error('Pull species: fetchAllRows error:', JSON.stringify(error));
    return;
  }
  let inserted = 0;
  let reconciled = 0;
  let skipped = 0;
  // Upsert por fila (no una sola transacción): un fallo en una especie no debe abortar el resto del catálogo.
  for (const s of data) {
    try {
      await upsertSpeciesById(db, s);
      inserted++;
    } catch (e: any) {
      // Probable choque por UNIQUE(codigo) con una especie local de distinto id.
      try {
        if (await reconcileSpeciesCodigoCollision(s)) {
          reconciled++;
        } else {
          skipped++;
          syncLog.error(`Pull species: skipping ${s.id} (codigo=${s.codigo}):`, e?.message ?? e);
        }
      } catch (e2: any) {
        skipped++;
        syncLog.error(`Pull species: reconcile falló ${s.id} (codigo=${s.codigo}):`, e2?.message ?? e2);
      }
    }
  }
  syncLog.info(`Pull species: ${inserted} upserted, ${reconciled} reconciled, ${skipped} skipped of ${data.length} total`);
}

// ─── Upload offline-created plantations ───────────────────────────────────────

/**
 * Sube plantaciones creadas offline (pendingSync=true): insert idempotente (23505 = ya existe en
 * server, continúa) + upsert de plantation_species + pendingSync=false. Devuelve un resultado por
 * plantación: un fallo bloquea silenciosamente sus parcelas/grupos (FK), así que el error debe
 * llegar al usuario, no tragarse.
 */
export async function uploadOfflinePlantations(): Promise<SyncPlantationResult[]> {
  const pending = await db
    .select()
    .from(plantations)
    .where(eq(plantations.pendingSync, true));

  const results: SyncPlantationResult[] = [];

  for (const p of pending) {
    // Errores que LANZAN (no solo `{ error }`) también deben surfacearse, no tragarse dejando
    // results vacío en runGlobalPreSteps.
    try {
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
          gps_capture_frequency: p.gpsCaptureFrequency,
          gps_capture_required: p.gpsCaptureRequired,
        });

      // unique_violation = la plantación ya existe en el server → seguimos con species
      if (plantError && plantError.code !== PG_ERROR.UNIQUE_VIOLATION) {
        syncLog.error('Upload plantation failed:', p.id, plantError.message);
        const { error: code, detail } = classifyServerError(plantError);
        results.push({ success: false, plantacionId: p.id, nombre: p.lugar, error: code, detail });
        continue;
      }

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

      await db
        .update(plantations)
        .set({ pendingSync: false })
        .where(eq(plantations.id, p.id));

      results.push({ success: true, plantacionId: p.id, nombre: p.lugar });
    } catch (e: any) {
      syncLog.error('Upload plantation exception:', p.id, e?.message ?? e);
      results.push({
        success: false, plantacionId: p.id, nombre: p.lugar,
        error: 'NETWORK', detail: rawErrorDetail({ message: String(e?.message ?? e) }),
      });
    }
  }

  return results;
}

// ─── Upload pending plantation edits ─────────────────────────────────────────

/** Pushea lugar/periodo/GPS editados offline (pendingEdit=true) a Supabase y limpia pendingEdit + columnas *Server local; fallos se loguean y se saltean. */
export async function uploadPendingEdits(): Promise<void> {
  const pending = await db
    .select()
    .from(plantations)
    .where(eq(plantations.pendingEdit, true));

  for (const p of pending) {
    try {
      const { error } = await supabase
        .from('plantations')
        .update({
          lugar: p.lugar,
          periodo: p.periodo,
          // Sube el valor GPS local vigente (idempotente si no se editó: espeja al server).
          gps_capture_frequency: p.gpsCaptureFrequency,
          gps_capture_required: p.gpsCaptureRequired,
        })
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

export async function runGlobalPreSteps(): Promise<SyncPlantationResult[]> {
  await supabase.auth.getSession();
  try { await pullSpeciesFromServer(); } catch (e) { syncLog.error('Pull species failed:', e); }
  let plantationResults: SyncPlantationResult[] = [];
  try { plantationResults = await uploadOfflinePlantations(); } catch (e) { syncLog.error('Upload offline plantations failed:', e); }
  try { await uploadPendingEdits(); } catch (e) { syncLog.error('Upload pending edits failed:', e); }
  return plantationResults;
}
