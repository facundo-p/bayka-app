/**
 * idGenerationService — coordina la generación de IDs definitivos y su
 * persistencia inmediata en Supabase.
 *
 * "Generar IDs" es una acción de admin que requiere conexión (se gatea en la UI):
 * asigna los IDs en SQLite local y los sube al server en el MISMO paso, con un
 * RPC dedicado y liviano (update_tree_ids), sin re-subir grupos/árboles enteros.
 *
 * Si el push falla parcial o totalmente, los grupos quedan pendingSync (red de
 * seguridad: generateIds los re-flagea) y la próxima sincronización los persiste.
 */
import { generateIds } from '../repositories/PlantationRepository';
import { markGroupSynced } from '../repositories/GroupRepository';
import { persistGeneratedTreeIds } from './sync/pushService';

export interface GenerateAndPersistResult {
  /** Árboles a los que se asignó ID. */
  total: number;
  /** Filas que el server confirmó haber actualizado. */
  updated: number;
  /** true solo si TODOS los IDs quedaron persistidos en el server. */
  persisted: boolean;
}

export async function generateAndPersistIds(
  plantacionId: string,
  seed: number
): Promise<GenerateAndPersistResult> {
  const { assignedIds, affectedGroupIds } = await generateIds(plantacionId, seed);

  const { success, updated } = await persistGeneratedTreeIds(assignedIds);
  const persisted = success && updated === assignedIds.length;

  if (persisted) {
    // IDs ya confirmados en el server → limpiar pendingSync de los grupos.
    for (const groupId of affectedGroupIds) {
      await markGroupSynced(groupId);
    }
  }

  return { total: assignedIds.length, updated, persisted };
}
