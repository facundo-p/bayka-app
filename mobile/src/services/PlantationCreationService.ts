/**
 * PlantationCreationService — crea una plantación + membresía admin + (si AUTO_PARCELA_DEFAULT)
 * su parcela default ("Parcela 1"/"P1") LOCAL-FIRST, siempre en una sola transacción SQLite
 * (#300): la parcela default ya era local-only (ParcelaRepository.createParcela escribe con
 * pendingSync), así que el alta "online" nunca fue atómica de por sí — ahora online y offline
 * comparten el mismo camino local; solo difieren en si se intenta un push inmediato después.
 * En modo 'online' el push es best-effort: si falla (red/servidor) no se throwea, la plantación
 * queda pendingSync y el próximo sync la reintenta — igual que el alta offline.
 * Único call site: usePlantationAdmin.handleCreateSubmit — los paths de pull/sync no deben
 * usarlo (las plantaciones de server traen sus parcelas vía pullParcelas).
 * Para eliminar: borrar este archivo + su import/call en usePlantationAdmin.ts, y volver a llamar
 * createPlantationWithParcelaLocally directo.
 */
import {
  createPlantationWithParcelaLocally,
  PlantationGpsSettings,
} from '../repositories/PlantationRepository';
import { uploadOfflinePlantations } from './sync/preSteps';
import { uploadSyncableParcelas } from './sync/pushService';
import { AUTO_PARCELA_DEFAULT } from '../config/featureFlags';
import { syncLog } from '../utils/syncLogger';

export type CreatePlantationMode = 'online' | 'offline';

export interface CreatePlantationParams {
  lugar: string;
  periodo: string;
  organizacionId: string;
  creadoPor: string;
  /** 'online': caller ya chequeó NetInfo y pide un push inmediato tras el alta local. */
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

/**
 * Empuja la plantación recién creada (y su parcela default) a Supabase reusando los pasos de
 * sync existentes: uploadOfflinePlantations (idempotente ante 23505 — la plantación ya existe)
 * y uploadSyncableParcelas (solo las parcelas de esta plantación). Nunca throwea: un fallo de
 * red/servidor deja pendingSync=true, y el próximo sync la reintenta.
 */
async function tryPushNow(plantationId: string): Promise<void> {
  try {
    await uploadOfflinePlantations();
    await uploadSyncableParcelas(plantationId);
  } catch (e) {
    syncLog.error(`createPlantationWithDefaultParcela: push inmediato falló para ${plantationId}, queda pendingSync`, e);
  }
}

/** Crea una plantación (y, si AUTO_PARCELA_DEFAULT, su parcela default) local-first; en modo 'online' intenta pushear de inmediato (best-effort). Retorna la misma forma que antes (drop-in). */
export async function createPlantationWithDefaultParcela(
  params: CreatePlantationParams,
): Promise<CreatePlantationResult> {
  const plantation = await createPlantationWithParcelaLocally({
    lugar: params.lugar,
    periodo: params.periodo,
    organizacionId: params.organizacionId,
    creadoPor: params.creadoPor,
    gps: params.gps,
    parcela: AUTO_PARCELA_DEFAULT ? { nombre: 'Parcela 1', codigo: 'P1' } : null,
  });

  if (params.mode === 'online') {
    await tryPushNow(plantation.id);
  }

  return plantation;
}
