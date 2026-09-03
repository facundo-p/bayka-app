/**
 * PlantationCreationService — crea una plantación y, si AUTO_PARCELA_DEFAULT, su parcela default
 * ("Parcela 1"/"P1") atómicamente. Único call site: usePlantationAdmin.handleCreateSubmit — los
 * paths de pull/sync no deben usarlo (las plantaciones de server traen sus parcelas vía pullParcelas).
 * El modo online llama a Supabase antes de la transacción local, así que un fallo de parcela puede
 * dejar la fila server sin su contraparte local.
 * Para eliminar: borrar este archivo + su import/call en usePlantationAdmin.ts, y volver a llamar
 * createPlantation/createPlantationLocally directo.
 */
import { db } from '../database/client';
import { plantations, plantationUsers } from '../database/schema';
import { eq } from 'drizzle-orm';
import {
  createPlantation,
  createPlantationLocally,
  PlantationGpsSettings,
} from '../repositories/PlantationRepository';
import { createParcela } from '../repositories/ParcelaRepository';
import { AUTO_PARCELA_DEFAULT } from '../config/featureFlags';

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
      // Rollback manual: borra la plantación local para no dejar una huérfana sin parcela default;
      // la membresía va primero (FK sin ON DELETE CASCADE). La fila server (modo online) no se
      // puede revertir desde acá.
      await db.delete(plantationUsers).where(eq(plantationUsers.plantationId, plantation.id));
      await db.delete(plantations).where(eq(plantations.id, plantation.id));
      throw e;
    }
  }
  return plantation;
}
