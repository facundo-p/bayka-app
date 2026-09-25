import { supabase } from '../../supabase/client';
import { db } from '../../database/client';
import { plantationSpecies, plantations } from '../../database/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { syncLog } from '../../utils/syncLogger';
import { relanzarSiEsCancelacion } from './cancelacion';
import { pullSpeciesFromServer } from './catalogoDeEspecies';
import { esTimeout } from '../../supabase/fetchConTimeout';
import { SYNC_ERROR, SyncPlantationResult, classifyServerError, rawErrorDetail, type SyncErrorCode } from './types';
import { MOTIVO_NO_ESCRIBIBLE } from '../PlantacionEscribibleService';
import { PG_ERROR } from '../../supabase/postgresErrorCodes';
import { hayOtraEnServidor } from './duplicadasEnServidor';
import { esRechazada, registrarEdicionSubida, subirEdicion } from './edicionDePlantacion';
import {
  aColumnasRemotas,
  aSnapshot,
  baseDe,
  baseDeLaEdicion,
  camposCambiados,
  camposDeFila,
  cambiosParaElServer,
  desdeSnapshot,
} from '../../utils/camposDePlantacion';
import { mismoLugarYPeriodo } from '../../utils/duplicadoDePlantacion';

type PlantacionLocal = typeof plantations.$inferSelect;

// ─── Upload offline-created plantations ───────────────────────────────────────

type FalloDeAlta = { error: SyncErrorCode; detail?: string };

/**
 * Rechazo al actualizar un alta que ya existía. Finalizada o archivada: queda pendiente con
 * ese motivo, que le dice al usuario qué pedir. Al reabrirla sube lo editado y sus especies;
 * sus parcelas y grupos no podrían escribirse igual mientras siga cerrada, así que marcarla
 * subida no destrabaría nada y perdería la edición en silencio. Si no, error crudo.
 */
function falloDeAltaRechazada(rechazo: string): FalloDeAlta {
  if (rechazo === MOTIVO_NO_ESCRIBIBLE.finalizada || rechazo === MOTIVO_NO_ESCRIBIBLE.archivada) return { error: rechazo };
  return { error: SYNC_ERROR.UNKNOWN, detail: rechazo };
}

/**
 * Ya existía: un intento anterior la insertó y fallaron las especies. Sube lo editado desde
 * ese intento, con lo que recibió el server (el snapshot) como base; lo que la web cambió en
 * el medio queda como conflicto a resolver (#634).
 */
async function actualizarAltaExistente(p: PlantacionLocal): Promise<ResultadoDeAlta> {
  const { cambios, base } = edicionDeAltaExistente(p);
  const resultado = await subirEdicion(p.id, cambios, base);
  if (esRechazada(resultado)) return { fallo: falloDeAltaRechazada(resultado.rechazo ?? ''), cambiosPorResolver: 0 };
  const cambiosPorResolver = await registrarEdicionSubida(p, { vivos: {}, cambios, base, resultado });
  return { fallo: null, cambiosPorResolver };
}

/**
 * Un alta de una versión que no guardaba el snapshot (sin lugar, que es obligatorio) no sabe
 * qué recibió el server: manda todo con su propio valor como base, así lo que difiera queda
 * como conflicto para que el usuario elija, en vez de pisarlo.
 */
function edicionDeAltaExistente(p: PlantacionLocal) {
  const actuales = camposDeFila(p);
  if (p.lugarServer == null) return { cambios: actuales, base: actuales };
  const subido = desdeSnapshot(p);
  const cambios = camposCambiados(subido, actuales);
  return { cambios, base: baseDe(cambios, subido) };
}

/** `fallo` null = subió; `cambiosPorResolver`: campos que chocaron con la web al reintentar. */
type ResultadoDeAlta = { fallo: FalloDeAlta | null; cambiosPorResolver: number };

/** Inserta la plantación y deja lo subido como snapshot: es la base de un reintento. */
async function subirFilaDeAlta(p: PlantacionLocal): Promise<ResultadoDeAlta> {
  const campos = camposDeFila(p);
  const { error } = await supabase.from('plantations').insert({
    id: p.id,
    organizacion_id: p.organizacionId,
    estado: p.estado,
    creado_por: p.creadoPor,
    created_at: p.createdAt,
    ...aColumnasRemotas(campos),
  });
  if (error?.code === PG_ERROR.UNIQUE_VIOLATION) return actualizarAltaExistente(p);
  if (error) return { fallo: classifyServerError(error), cambiosPorResolver: 0 };
  await db.update(plantations).set(aSnapshot(campos)).where(eq(plantations.id, p.id));
  return { fallo: null, cambiosPorResolver: 0 };
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
      const { fallo, cambiosPorResolver } = await subirFilaDeAlta(p);
      if (fallo) {
        syncLog.error('Upload plantation failed:', p.id, fallo.error, fallo.detail ?? '');
        results.push({ success: false, plantacionId: p.id, nombre: p.lugar, ...fallo });
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

      results.push({
        success: true, plantacionId: p.id, nombre: p.lugar, duplicada: await hayOtraEnServidor(p), cambiosPorResolver,
      });
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
 * Sube por `editar_plantacion` solo lo que difiere de la base (lo que el server tenía al
 * editar) y lo refleja en SQLite. Null si el server rechazó o falló: queda pendiente para
 * el próximo sync. Si no, cuántos campos quedaron en conflicto con la web.
 */
async function pushEdicionPlantacion(p: PlantacionLocal): Promise<number | null> {
  const cambios = cambiosParaElServer(p);
  const base = baseDe(cambios, baseDeLaEdicion(p));
  try {
    const resultado = await subirEdicion(p.id, cambios, base);
    if (esRechazada(resultado)) {
      syncLog.error('Upload pending edit rejected:', p.id, resultado.rechazo);
      return null;
    }
    return await registrarEdicionSubida(p, { vivos: camposDeFila(p), cambios, base, resultado });
  } catch (e: any) {
    relanzarSiEsCancelacion(e);
    syncLog.error('Upload pending edit failed:', p.id, e?.message);
    return null;
  }
}

/** Solo si la edición cambió lugar o periodo: si no, la duplicada ya existía antes. */
async function edicionDuplicada(p: PlantacionLocal): Promise<boolean> {
  const base = baseDeLaEdicion(p);
  const antes = { lugar: base.lugar ?? '', periodo: base.periodo ?? '' };
  return !mismoLugarYPeriodo(p, antes) && hayOtraEnServidor(p);
}

/**
 * Pushea las ediciones offline (pendingEdit=true). Devuelve las que el server aceptó, con los
 * campos que chocaron con la web; las que fallan se loguean y se reintentan en el próximo sync.
 */
export async function uploadPendingEdits(): Promise<SyncPlantationResult[]> {
  const pending = await db
    .select()
    .from(plantations)
    // Eliminada en el server (#478): no hay fila que actualizar, la edición queda local.
    .where(and(eq(plantations.pendingEdit, true), isNull(plantations.eliminadaEnServidorEn)));

  const subidas: SyncPlantationResult[] = [];
  for (const p of pending) {
    const cambiosPorResolver = await pushEdicionPlantacion(p);
    if (cambiosPorResolver === null) continue;
    subidas.push({
      success: true, plantacionId: p.id, nombre: p.lugar, duplicada: await edicionDuplicada(p), cambiosPorResolver,
    });
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
