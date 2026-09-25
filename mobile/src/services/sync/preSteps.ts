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
import { hayOtraEnServidor } from './duplicadasEnServidor';
import {
  aColumnasRemotas,
  aSnapshot,
  camposDeFila,
  cambiosParaElServer,
  hayCambios,
  type CamposDePlantacion,
} from '../../utils/camposDePlantacion';
import { mismoLugarYPeriodo } from '../../utils/duplicadoDePlantacion';

type PlantacionLocal = typeof plantations.$inferSelect;

// ─── Upload offline-created plantations ───────────────────────────────────────

type ErrorDelServer = { code?: string; message?: string };

/**
 * Inserta la plantación. Si ya existe (un intento anterior la insertó y fallaron las especies),
 * la actualiza con los campos actuales para no perder lo editado en el medio.
 */
async function subirFilaDeAlta(p: PlantacionLocal): Promise<ErrorDelServer | null> {
  const campos = aColumnasRemotas(camposDeFila(p));
  const { error } = await supabase.from('plantations').insert({
    id: p.id,
    organizacion_id: p.organizacionId,
    estado: p.estado,
    creado_por: p.creadoPor,
    created_at: p.createdAt,
    ...campos,
  });
  if (error?.code !== PG_ERROR.UNIQUE_VIOLATION) return error;

  const { data, error: updateError } = await supabase.from('plantations').update(campos).eq('id', p.id).select('id');
  if (updateError) return updateError;
  return sinFilasAfectadas(data) ? { message: DETALLE_SIN_FILAS_AFECTADAS } : null;
}

/**
 * Sube plantaciones creadas offline (pendingSync=true): insert idempotente (si ya existe, update)
 * + upsert de plantation_species + pendingSync=false, solo si las dos subieron. Devuelve un resultado por plantación: un fallo bloquea silenciosamente sus
 * parcelas/grupos (FK), así que el error debe llegar al usuario, no tragarse.
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
      const plantError = await subirFilaDeAlta(p);

      if (plantError) {
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
        // Sin especies la plantación no es usable: queda pendiente para reintentar (#632).
        if (psError) {
          syncLog.error('Upload plantation_species failed:', p.id, psError.message);
          const { error: code, detail } = classifyServerError(psError);
          results.push({ success: false, plantacionId: p.id, nombre: p.lugar, error: code, detail });
          continue;
        }
      }

      await db
        .update(plantations)
        .set({ pendingSync: false })
        .where(eq(plantations.id, p.id));

      results.push({ success: true, plantacionId: p.id, nombre: p.lugar, duplicada: await hayOtraEnServidor(p) });
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

/**
 * `true` si el server confirmó el cambio en la fila de la plantación, o si no había nada que
 * subir. Sube solo lo que difiere del snapshot, para no pisar lo que la fila nunca bajó.
 */
async function pushEdicionPlantacion(p: PlantacionLocal, cambios: Partial<CamposDePlantacion>): Promise<boolean> {
  if (!hayCambios(cambios)) return true;
  const { data, error } = await supabase
    .from('plantations')
    .update(aColumnasRemotas(cambios))
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

/** Solo si la edición cambió lugar o periodo: si no, la duplicada ya existía antes. */
async function edicionDuplicada(p: PlantacionLocal): Promise<boolean> {
  const antes = { lugar: p.lugarServer ?? '', periodo: p.periodoServer ?? '' };
  return !mismoLugarYPeriodo(p, antes) && hayOtraEnServidor(p);
}

/**
 * Pushea las ediciones offline (pendingEdit=true), limpia pendingEdit y deja el snapshot
 * *Server con lo subido. Devuelve las que subieron; las que fallan se loguean y se reintentan
 * en el próximo sync.
 */
export async function uploadPendingEdits(): Promise<SyncPlantationResult[]> {
  const pending = await db
    .select()
    .from(plantations)
    // Eliminada en el server (#478): no hay fila que actualizar, la edición queda local.
    .where(and(eq(plantations.pendingEdit, true), isNull(plantations.eliminadaEnServidorEn)));

  const subidas: SyncPlantationResult[] = [];
  for (const p of pending) {
    try {
      const cambios = cambiosParaElServer(p);
      if (!(await pushEdicionPlantacion(p, cambios))) continue;

      await db
        .update(plantations)
        .set({ pendingEdit: false, ...aSnapshot(cambios) })
        .where(eq(plantations.id, p.id));
      subidas.push({ success: true, plantacionId: p.id, nombre: p.lugar, duplicada: await edicionDuplicada(p) });
    } catch (e: any) {
      relanzarSiEsCancelacion(e);
      syncLog.error('Upload pending edit exception:', p.id, e?.message);
    }
  }
  return subidas;
}

// ─── Global pre-steps ────────────────────────────────────────────────────────

export async function runGlobalPreSteps(): Promise<SyncPlantationResult[]> {
  await supabase.auth.getSession();
  // Los pre-steps corren ANTES del primer evento de progreso: si se cuelgan acá, el
  // watchdog ofrece cancelar y sin estos re-lanzados el botón no haría nada (#451).
  try { await pullSpeciesFromServer(); } catch (e) { relanzarSiEsCancelacion(e); syncLog.error('Pull species failed:', e); }
  let altas: SyncPlantationResult[] = [];
  let ediciones: SyncPlantationResult[] = [];
  try { altas = await uploadOfflinePlantations(); } catch (e) { relanzarSiEsCancelacion(e); syncLog.error('Upload offline plantations failed:', e); }
  try { ediciones = await uploadPendingEdits(); } catch (e) { relanzarSiEsCancelacion(e); syncLog.error('Upload pending edits failed:', e); }
  return [...altas, ...ediciones];
}
