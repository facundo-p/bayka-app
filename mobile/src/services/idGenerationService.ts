/**
 * idGenerationService — genera los IDs definitivos y los persiste en Supabase en
 * el MISMO paso.
 *
 * "Generar IDs" es una acción de admin que requiere conexión (se gatea en la UI):
 * asigna los IDs en SQLite local y los sube al server de inmediato con un RPC
 * dedicado y liviano (update_tree_ids), sin re-subir grupos/árboles enteros.
 *
 * `generateIds` NO marca pendingSync. Si el push falla, la UI le ofrece al usuario
 * reintentar (`retryPersistIds`) o diferir (`deferIdsToSync`, que recién ahí marca
 * los grupos pendingSync para subirlos en la próxima sincronización).
 */
import { generateIds } from '../repositories/PlantationRepository';
import { markGroupPendingSync } from '../repositories/GroupRepository';
import { persistGeneratedTreeIds } from './sync/pushService';

export interface AssignedTreeId {
  id: string;
  plantacionId: number;
  globalId: number;
}

export interface PersistIdsResult {
  /** Árboles a los que se asignó ID. */
  total: number;
  /** Filas que el server confirmó haber actualizado. */
  updated: number;
  /** true solo si TODOS los IDs quedaron persistidos en el server. */
  persisted: boolean;
  /** Tuplas asignadas (para reintentar el push sin re-generar). */
  assignedIds: AssignedTreeId[];
  /** Grupos afectados (para diferir/marcar pendingSync si el usuario elige). */
  affectedGroupIds: string[];
}

export async function generateAndPersistIds(
  plantacionId: string,
  seed: number
): Promise<PersistIdsResult> {
  const { assignedIds, affectedGroupIds } = await generateIds(plantacionId, seed);
  return pushIds(assignedIds, affectedGroupIds);
}

/** Reintenta el push de IDs ya generados (no re-genera). */
export async function retryPersistIds(
  assignedIds: AssignedTreeId[],
  affectedGroupIds: string[]
): Promise<PersistIdsResult> {
  return pushIds(assignedIds, affectedGroupIds);
}

/** Difiere la persistencia: marca los grupos pendingSync para la próxima sync. */
export async function deferIdsToSync(affectedGroupIds: string[]): Promise<void> {
  for (const groupId of affectedGroupIds) {
    await markGroupPendingSync(groupId);
  }
}

async function pushIds(
  assignedIds: AssignedTreeId[],
  affectedGroupIds: string[]
): Promise<PersistIdsResult> {
  const { success, updated } = await persistGeneratedTreeIds(assignedIds);
  return {
    total: assignedIds.length,
    updated,
    persisted: success && updated === assignedIds.length,
    assignedIds,
    affectedGroupIds,
  };
}
