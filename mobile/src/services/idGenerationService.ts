/**
 * idGenerationService — genera los IDs definitivos y los persiste en Supabase en
 * el MISMO paso.
 *
 * "Generar IDs" es una acción de admin que requiere conexión (se gatea en la UI):
 * asigna los IDs en SQLite local y los sube al server de inmediato con un RPC
 * dedicado y liviano (update_tree_ids), sin re-subir grupos/árboles enteros.
 *
 * Invariante: los IDs existen en local ⟺ están subidos al server. Por eso, si el
 * push falla (o queda parcial), se **revierten** los IDs locales: la plantación
 * queda como si nunca se hubieran generado, el gate vuelve a ofrecer "Generar IDs"
 * (ese botón es el único mecanismo para subir los IDs) y el export queda oculto
 * hasta que estén confirmados en el server. No se usa pendingSync ni la sync de
 * toda la plantación (que está finalizada).
 */
import { generateIds, clearGeneratedIds } from '../repositories/PlantationRepository';
import { persistGeneratedTreeIds } from './sync/pushService';

export interface PersistIdsResult {
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
): Promise<PersistIdsResult> {
  const { assignedIds } = await generateIds(plantacionId, seed);
  const { success, updated } = await persistGeneratedTreeIds(assignedIds);
  const persisted = success && updated === assignedIds.length;

  if (!persisted) {
    // El push no quedó completo → revertir para que "Generar IDs" siga disponible
    // y el export no aparezca hasta que los IDs estén realmente en el server.
    await clearGeneratedIds(plantacionId);
  }

  return { total: assignedIds.length, updated, persisted };
}
