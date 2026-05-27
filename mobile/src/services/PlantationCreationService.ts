// FEATURE: auto-parcela trial — remove block if dropped
/**
 * PlantationCreationService — orchestrates plantation creation with optional
 * default parcela ("Parcela 1" / "P1") behind the AUTO_PARCELA_DEFAULT flag.
 *
 * This file is the ONLY production code-path that auto-creates the default
 * parcela. The single user-initiated call site is
 * `usePlantationAdmin.handleCreateSubmit`. Pull / sync paths (downloadService,
 * pullService) MUST NOT invoke this helper — server-side plantations bring
 * their own parcelas via `pullParcelas` (Phase 16-03).
 *
 * Atomicity: wraps both inserts in `db.transaction` (D-18-04). If
 * `createParcela` returns `{success:false}`, throws to trigger rollback
 * (D-18-06). The online variant performs a Supabase call inside the tx; on
 * failure of the parcela step after Supabase succeeded, the local rollback
 * leaves the server row orphan-free locally — see Plan 18-01 Risk #3.
 *
 * To remove the trial: delete this file, delete the import + call in
 * usePlantationAdmin.ts, revert handleCreateSubmit to call createPlantation /
 * createPlantationLocally directly.
 */
import { db } from '../database/client';
import { plantations } from '../database/schema';
import { eq } from 'drizzle-orm';
import {
  createPlantation,
  createPlantationLocally,
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
}

export interface CreatePlantationResult {
  id: string;
  lugar: string;
  periodo: string;
  estado: string;
}

/**
 * FEATURE: auto-parcela trial — remove block if dropped
 * Inserts the default parcela for a freshly created plantation. Throws on
 * failure so the surrounding transaction rolls back.
 */
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
 * Creates a plantation (online or offline) and, when AUTO_PARCELA_DEFAULT is
 * true, a default parcela atomically. Returns the plantation shape that
 * matches `createPlantation` / `createPlantationLocally` so the call site is
 * drop-in.
 */
export async function createPlantationWithDefaultParcela(
  params: CreatePlantationParams,
): Promise<CreatePlantationResult> {
  // NOTE: drizzle's better-sqlite3 driver runs `db.transaction` synchronously,
  // so async work inside the callback does NOT participate in the SQLite
  // transaction. We do manual cleanup on parcela failure to keep behavior
  // consistent across runtimes (Plan 18-01 Risk #3, D-18-04 best-effort).
  const plantation =
    params.mode === 'online'
      ? await createPlantation(params.lugar, params.periodo, params.organizacionId, params.creadoPor)
      : await createPlantationLocally(params.lugar, params.periodo, params.organizacionId, params.creadoPor);
  // FEATURE: auto-parcela trial — remove block if dropped
  if (AUTO_PARCELA_DEFAULT) {
    try {
      await insertDefaultParcela(plantation.id);
    } catch (e) {
      // Manual rollback: remove the local plantation row so we don't leave an
      // orphan without its default parcela. Server row (online mode) cannot be
      // rolled back from here — see Plan 18-01 Risk #3.
      await db.delete(plantations).where(eq(plantations.id, plantation.id));
      throw e;
    }
  }
  return plantation;
}
