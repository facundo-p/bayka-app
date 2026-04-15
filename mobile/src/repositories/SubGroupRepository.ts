import { db } from '../database/client';
import { subgroups, trees, species as speciesTable } from '../database/schema';
import { eq, and, desc, count, asc, sql } from 'drizzle-orm';
import { notifyDataChanged } from '../database/liveQuery';
import * as Crypto from 'expo-crypto';
import { localNow } from '../utils/dateUtils';
import { generateSubId } from '../utils/idGenerator';

export type SubGroupEstado = 'activa' | 'finalizada';
export type SubGroupTipo = 'linea' | 'parcela';

export interface SubGroup {
  id: string;
  plantacionId: string;
  nombre: string;
  codigo: string;
  tipo: SubGroupTipo;
  estado: SubGroupEstado;
  usuarioCreador: string;
  createdAt: string;
  pendingSync: boolean;
}

// Returns the nombre of the most recently created SubGroup for this plantation.
// Returns null if none exist. Used by create form to show reference.
export async function getLastSubGroupName(plantacionId: string): Promise<string | null> {
  const rows = await db.select({ nombre: subgroups.nombre })
    .from(subgroups)
    .where(eq(subgroups.plantacionId, plantacionId))
    .orderBy(desc(subgroups.createdAt))
    .limit(1);
  return rows[0]?.nombre ?? null;
}

type DuplicateError = 'codigo_duplicate' | 'nombre_duplicate' | 'both_duplicate';

/**
 * Validates that nombre and codigo are unique within a plantation.
 * Pass excludeId to exclude a specific subgroup (for updates).
 */
async function validateSubGroupUniqueness(
  plantacionId: string,
  nombre: string,
  codigo: string,
  excludeId?: string,
): Promise<DuplicateError | null> {
  const nombreConditions = [
    eq(subgroups.plantacionId, plantacionId),
    eq(subgroups.nombre, nombre),
  ];
  const codigoConditions = [
    eq(subgroups.plantacionId, plantacionId),
    eq(subgroups.codigo, codigo),
  ];

  if (excludeId) {
    nombreConditions.push(sql`${subgroups.id} != ${excludeId}`);
    codigoConditions.push(sql`${subgroups.id} != ${excludeId}`);
  }

  const [existingNombre] = await db.select({ id: subgroups.id })
    .from(subgroups)
    .where(and(...nombreConditions))
    .limit(1);
  const [existingCodigo] = await db.select({ id: subgroups.id })
    .from(subgroups)
    .where(and(...codigoConditions))
    .limit(1);

  if (existingNombre && existingCodigo) return 'both_duplicate';
  if (existingNombre) return 'nombre_duplicate';
  if (existingCodigo) return 'codigo_duplicate';
  return null;
}

export type CreateSubGroupResult =
  | { success: true; id: string }
  | { success: false; error: 'codigo_duplicate' | 'nombre_duplicate' | 'both_duplicate' | 'unknown' };

export async function createSubGroup(params: {
  plantacionId: string;
  nombre: string;
  codigo: string;
  tipo: SubGroupTipo;
  usuarioCreador: string;
}): Promise<CreateSubGroupResult> {
  const upperCodigo = params.codigo.toUpperCase();

  const duplicateError = await validateSubGroupUniqueness(params.plantacionId, params.nombre, upperCodigo);
  if (duplicateError) return { success: false, error: duplicateError };

  try {
    const id = Crypto.randomUUID();
    await db.insert(subgroups).values({
      id,
      plantacionId: params.plantacionId,
      nombre: params.nombre,
      codigo: upperCodigo,
      tipo: params.tipo,
      estado: 'activa',
      usuarioCreador: params.usuarioCreador,
      createdAt: localNow(),
      pendingSync: true,
    });
    notifyDataChanged();
    return { success: true, id };
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'codigo_duplicate' };
    }
    return { success: false, error: 'unknown' };
  }
}

// Marks a subgroup as having pending local changes (dirty flag).
// Called after any mutation that modifies subgroup or its trees.
export async function markSubGroupPendingSync(subgrupoId: string): Promise<void> {
  await db.update(subgroups)
    .set({ pendingSync: true })
    .where(eq(subgroups.id, subgrupoId));
}

// Marks a subgroup as synced after successful server sync.
// Called by SyncService after RPC confirms the upload.
// Sets estado to 'sincronizada' to match server state immediately,
// without waiting for the next pull to update it.
export async function markSubGroupSynced(subgrupoId: string): Promise<void> {
  await db.update(subgroups)
    .set({ pendingSync: false, estado: 'sincronizada' })
    .where(eq(subgroups.id, subgrupoId));
  notifyDataChanged();
}

// Finalizes a SubGroup (activa → finalizada). N/N trees are allowed —
// the sync gate (not finalization) blocks upload of unresolved N/N.
export async function finalizeSubGroup(subgrupoId: string): Promise<{ success: true }> {
  await db.update(subgroups)
    .set({ estado: 'finalizada' })
    .where(eq(subgroups.id, subgrupoId));

  await markSubGroupPendingSync(subgrupoId);
  notifyDataChanged();
  return { success: true };
}

// Ownership guard — inline in screens before showing edit UI.
// Checks plantation estado (finalizada = immutable) instead of subgroup estado.
export function canEdit(
  subgroup: { usuarioCreador: string },
  userId: string,
  plantacionEstado: string
): boolean {
  if (plantacionEstado === 'finalizada') return false;
  return subgroup.usuarioCreador === userId;
}

/**
 * Deletes a subgroup and all its trees.
 * Returns the number of trees that were deleted so the UI can show a warning.
 */
export type UpdateSubGroupResult =
  | { success: true }
  | { success: false; error: 'codigo_duplicate' | 'nombre_duplicate' | 'both_duplicate' | 'unknown' };

export async function updateSubGroup(
  id: string,
  params: { nombre: string; codigo: string; tipo: SubGroupTipo }
): Promise<UpdateSubGroupResult> {
  const upperCodigo = params.codigo.toUpperCase();

  // Get current subgroup to know plantacionId
  const [current] = await db.select({ plantacionId: subgroups.plantacionId })
    .from(subgroups).where(eq(subgroups.id, id));
  if (!current) return { success: false, error: 'unknown' };

  const duplicateError = await validateSubGroupUniqueness(current.plantacionId, params.nombre, upperCodigo, id);
  if (duplicateError) return { success: false, error: duplicateError };

  await db.update(subgroups)
    .set({
      nombre: params.nombre,
      codigo: upperCodigo,
      tipo: params.tipo,
    })
    .where(eq(subgroups.id, id));
  await markSubGroupPendingSync(id);
  notifyDataChanged();
  return { success: true };
}

/**
 * Updates subgroup codigo and recalculates all tree subIds in a transaction.
 */
export async function updateSubGroupCode(
  id: string,
  newCodigo: string,
  oldCodigo: string
): Promise<UpdateSubGroupResult> {
  const upperCodigo = newCodigo.toUpperCase();

  // Get current subgroup to know plantacionId
  const [current] = await db.select({ plantacionId: subgroups.plantacionId })
    .from(subgroups).where(eq(subgroups.id, id));
  if (!current) return { success: false, error: 'unknown' };

  // Pre-check codigo uniqueness (exclude self)
  const [existingCodigo] = await db.select({ id: subgroups.id })
    .from(subgroups)
    .where(and(
      eq(subgroups.plantacionId, current.plantacionId),
      eq(subgroups.codigo, upperCodigo),
      sql`${subgroups.id} != ${id}`
    ))
    .limit(1);
  if (existingCodigo) return { success: false, error: 'codigo_duplicate' };

  try {
    await db.transaction(async (tx) => {
      // Update the subgroup codigo
      await tx.update(subgroups)
        .set({ codigo: upperCodigo })
        .where(eq(subgroups.id, id));

      // Recalculate all tree subIds
      const allTrees = await tx.select().from(trees)
        .where(eq(trees.subgrupoId, id))
        .orderBy(asc(trees.posicion));

      for (const tree of allTrees) {
        let especieCodigo = 'NN';
        if (tree.especieId) {
          const [sp] = await tx.select({ codigo: speciesTable.codigo })
            .from(speciesTable)
            .where(eq(speciesTable.id, tree.especieId));
          especieCodigo = sp?.codigo ?? 'NN';
        }
        const newSubId = generateSubId(newCodigo.toUpperCase(), especieCodigo, tree.posicion);
        await tx.update(trees)
          .set({ subId: newSubId })
          .where(eq(trees.id, tree.id));
      }
    });
    await markSubGroupPendingSync(id);
    notifyDataChanged();
    return { success: true };
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE constraint failed')) {
      if (e.message.includes('name_unique')) {
        return { success: false, error: 'nombre_duplicate' };
      }
      return { success: false, error: 'codigo_duplicate' };
    }
    return { success: false, error: 'unknown' };
  }
}

/**
 * Reactivates a finalized subgroup back to 'activa' state.
 * Only works for 'finalizada' state.
 */
export async function reactivateSubGroup(id: string): Promise<void> {
  await db.update(subgroups)
    .set({ estado: 'activa' })
    .where(eq(subgroups.id, id));
  await markSubGroupPendingSync(id);
  notifyDataChanged();
}

export async function deleteSubGroup(subgrupoId: string): Promise<{ deleted: boolean; treeCount: number }> {
  const [treeResult] = await db.select({ count: count() })
    .from(trees)
    .where(eq(trees.subgrupoId, subgrupoId));

  const treeCount = treeResult?.count ?? 0;

  await db.delete(trees).where(eq(trees.subgrupoId, subgrupoId));
  await db.delete(subgroups).where(eq(subgroups.id, subgrupoId));

  notifyDataChanged();
  return { deleted: true, treeCount };
}

// Returns all finalizada subgroups for a plantation (pending sync).
// Used by SyncService to know which subgroups to upload.
// When userId is provided, only returns subgroups created by that user.
export async function getFinalizadaSubGroups(plantacionId: string, userId?: string): Promise<SubGroup[]> {
  const conditions = [
    eq(subgroups.plantacionId, plantacionId),
    eq(subgroups.estado, 'finalizada'),
  ];
  if (userId) {
    conditions.push(eq(subgroups.usuarioCreador, userId));
  }
  return db.select().from(subgroups)
    .where(and(...conditions)) as unknown as SubGroup[];
}

// Returns subgroups with pendingSync=true that are ready to sync.
// Includes both 'finalizada' and 'sincronizada' — the latter have pending
// changes (e.g., N/N resolution) that need to reach the server.
// No userId filter: any user assigned to the plantation can sync changes
// (e.g., resolving N/N on trees created by another user).
export async function getSyncableSubGroups(plantacionId: string, _userId?: string): Promise<SubGroup[]> {
  const conditions = [
    eq(subgroups.plantacionId, plantacionId),
    eq(subgroups.pendingSync, true),
  ];
  return db.select().from(subgroups).where(and(...conditions)) as unknown as SubGroup[];
}

// Returns total count of subgroups with pendingSync=true across all plantations.
// Used by dashboard badge to show total pending sync count.
// When userId is provided, only counts subgroups created by that user.
export async function getPendingSyncCount(userId?: string): Promise<number> {
  const conditions = [eq(subgroups.pendingSync, true)];
  if (userId) {
    conditions.push(eq(subgroups.usuarioCreador, userId));
  }
  const result = await db.select({ cnt: count() })
    .from(subgroups)
    .where(and(...conditions));
  return result[0]?.cnt ?? 0;
}
