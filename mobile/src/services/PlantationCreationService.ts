/**
 * PlantationCreationService — crea una plantación y, si AUTO_PARCELA_DEFAULT, su parcela default
 * ("Parcela 1"/"P1") atómicamente. Único call site: usePlantationAdmin.handleCreateSubmit — los
 * paths de pull/sync no deben usarlo (las plantaciones de server traen sus parcelas vía pullParcelas).
 * El modo online llama a Supabase antes de la transacción local: si la parcela falla, el rollback
 * borra primero las filas locales y recién después la fila server (best-effort); si el delete
 * remoto también falla, el error final avisa que puede haber quedado una fila huérfana en el server.
 * Para eliminar: borrar este archivo + su import/call en usePlantationAdmin.ts, y volver a llamar
 * createPlantation/createPlantationLocally directo.
 */
import {
  createPlantation,
  createPlantationLocally,
  deletePlantationLocally,
  deletePlantationRemotely,
  PlantationGpsSettings,
} from '../repositories/PlantationRepository';
import { createParcela } from '../repositories/ParcelaRepository';
import { AUTO_PARCELA_DEFAULT } from '../config/featureFlags';
import { syncLog } from '../utils/syncLogger';

export type CreatePlantationMode = 'online' | 'offline';

export interface CreatePlantationParams {
  lugar: string;
  periodo: string;
  organizacionId: string;
  creadoPor: string;
  mode: CreatePlantationMode;
  /** Config GPS elegida por el admin en el form (defaults del schema si falta). */
  gps?: PlantationGpsSettings;
}

export interface CreatePlantationResult {
  id: string;
  lugar: string;
  periodo: string;
  estado: string;
}

/** Inserta la parcela default de una plantación recién creada; lanza si falla, para que la transacción envolvente haga rollback. */
async function insertDefaultParcela(plantacionId: string): Promise<void> {
  const r = await createParcela({
    plantacionId,
    nombre: 'Parcela 1',
    codigo: 'P1',
    descripcion: null,
  });
  if (!r.success) {
    throw new Error(`Default parcela creation failed: ${r.error}`);
  }
}

/**
 * Rollback ante fallo de parcela: borra primero las filas locales (deletePlantationLocally,
 * transaccional y con el orden de FK correcto); si eso falla, se propaga tal cual — el server
 * todavía no se tocó, queda consistente con el estado previo. En modo online borra después la
 * fila server (best-effort); si ese delete falla, el error final avisa del posible huérfano.
 */
async function rollbackFailedPlantation(plantationId: string, mode: CreatePlantationMode, originalError: unknown): Promise<never> {
  await deletePlantationLocally(plantationId);
  if (mode === 'online') {
    try {
      await deletePlantationRemotely(plantationId);
    } catch (remoteError) {
      syncLog.error(`createPlantationWithDefaultParcela: no se pudo borrar la plantación remota ${plantationId} tras fallo de parcela default`, remoteError);
      const originalMessage = originalError instanceof Error ? originalError.message : String(originalError);
      throw new Error(
        `${originalMessage} (además, no se pudo borrar la plantación remota; puede haber quedado sin parcela)`,
        { cause: originalError }
      );
    }
  }
  throw originalError;
}

/** Crea una plantación (online/offline) y, si AUTO_PARCELA_DEFAULT, su parcela default atómicamente; retorna la misma forma que createPlantation/createPlantationLocally (drop-in). */
export async function createPlantationWithDefaultParcela(
  params: CreatePlantationParams,
): Promise<CreatePlantationResult> {
  // El driver better-sqlite3 de drizzle corre db.transaction síncrono: el trabajo async del
  // callback no participa de la transacción SQLite, por eso el cleanup en fallo de parcela es manual.
  const plantation =
    params.mode === 'online'
      ? await createPlantation(params.lugar, params.periodo, params.organizacionId, params.creadoPor, params.gps)
      : await createPlantationLocally(params.lugar, params.periodo, params.organizacionId, params.creadoPor, params.gps);
  if (AUTO_PARCELA_DEFAULT) {
    try {
      await insertDefaultParcela(plantation.id);
    } catch (e) {
      await rollbackFailedPlantation(plantation.id, params.mode, e);
    }
  }
  return plantation;
}
