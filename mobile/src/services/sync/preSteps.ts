import { supabase } from '../../supabase/client';
import { db } from '../../database/client';
import { plantationSpecies, plantations } from '../../database/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { syncLog } from '../../utils/syncLogger';
import { relanzarSiEsCancelacion } from './cancelacion';
import { pullSpeciesFromServer } from './catalogoDeEspecies';
import { esTimeout } from '../../supabase/fetchConTimeout';
import { SYNC_ERROR, SyncPlantationResult, classifyServerError, rawErrorDetail } from './types';
import { PG_ERROR } from '../../supabase/postgresErrorCodes';
import { DETALLE_SIN_FILAS_AFECTADAS, sinFilasAfectadas } from './filasAfectadas';

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
      relanzarSiEsCancelacion(e);
      syncLog.error('Upload plantation exception:', p.id, e?.message ?? e);
      results.push({
        success: false, plantacionId: p.id, nombre: p.lugar,
        error: esTimeout(e) ? SYNC_ERROR.TIMEOUT : SYNC_ERROR.NETWORK,
        detail: rawErrorDetail({ message: String(e?.message ?? e) }),
      });
    }
  }

  return results;
}

// ─── Upload pending plantation edits ─────────────────────────────────────────

type PlantacionLocal = typeof plantations.$inferSelect;

/** `true` solo si el server confirmó el cambio en la fila de la plantación. */
async function pushEdicionPlantacion(p: PlantacionLocal): Promise<boolean> {
  const { data, error } = await supabase
    .from('plantations')
    .update({
      lugar: p.lugar,
      periodo: p.periodo,
      // Sube el valor GPS local vigente (idempotente si no se editó: espeja al server).
      gps_capture_frequency: p.gpsCaptureFrequency,
      gps_capture_required: p.gpsCaptureRequired,
    })
    .eq('id', p.id)
    .select('id');
  if (error) {
    syncLog.error('Upload pending edit failed:', p.id, error.message);
    return false;
  }
  if (sinFilasAfectadas(data)) {
    syncLog.error('Upload pending edit failed:', p.id, DETALLE_SIN_FILAS_AFECTADAS);
    return false;
  }
  return true;
}

/** Pushea lugar/periodo/GPS editados offline (pendingEdit=true) a Supabase y limpia pendingEdit + columnas *Server local; fallos se loguean y se saltean. */
export async function uploadPendingEdits(): Promise<void> {
  const pending = await db
    .select()
    .from(plantations)
    // Eliminada en el server (#478): no hay fila que actualizar, la edición queda local.
    .where(and(eq(plantations.pendingEdit, true), isNull(plantations.eliminadaEnServidorEn)));

  for (const p of pending) {
    try {
      if (!(await pushEdicionPlantacion(p))) continue;

      await db
        .update(plantations)
        .set({
          pendingEdit: false,
          lugarServer: p.lugar,
          periodoServer: p.periodo,
        })
        .where(eq(plantations.id, p.id));
    } catch (e: any) {
      relanzarSiEsCancelacion(e);
      syncLog.error('Upload pending edit exception:', p.id, e?.message);
    }
  }
}

// ─── Global pre-steps ────────────────────────────────────────────────────────

export async function runGlobalPreSteps(): Promise<SyncPlantationResult[]> {
  await supabase.auth.getSession();
  // Los pre-steps corren ANTES del primer evento de progreso: si se cuelgan acá, el
  // watchdog ofrece cancelar y sin estos re-lanzados el botón no haría nada (#451).
  try { await pullSpeciesFromServer(); } catch (e) { relanzarSiEsCancelacion(e); syncLog.error('Pull species failed:', e); }
  let plantationResults: SyncPlantationResult[] = [];
  try { plantationResults = await uploadOfflinePlantations(); } catch (e) { relanzarSiEsCancelacion(e); syncLog.error('Upload offline plantations failed:', e); }
  try { await uploadPendingEdits(); } catch (e) { relanzarSiEsCancelacion(e); syncLog.error('Upload pending edits failed:', e); }
  return plantationResults;
}
