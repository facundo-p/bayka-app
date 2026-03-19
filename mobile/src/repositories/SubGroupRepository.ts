import { db } from '../database/client';
import { subgroups, trees, species as speciesTable } from '../database/schema';
import { eq, and, desc, isNull, count, asc, sql } from 'drizzle-orm';
import { notifyDataChanged } from '../database/liveQuery';
import * as Crypto from 'expo-crypto';
import { localNow } from '../utils/dateUtils';
import { generateSubId } from '../utils/idGenerator';

export type SubGroupEstado = 'activa' | 'finalizada' | 'sincronizada';
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

export type FinalizeResult =
  | { success: true }
  | { success: false; error: 'unresolved_nn'; count: number };

// Blocks finalization if there are trees with especieId IS NULL (N/N unresolved).
export async function finalizeSubGroup(subgrupoId: string): Promise<FinalizeResult> {
  const [nnResult] = await db.select({ count: count() })
    .from(trees)
    .where(and(eq(trees.subgrupoId, subgrupoId), isNull(trees.especieId)));

  const unresolvedCount = nnResult?.count ?? 0;
  if (unresolvedCount > 0) {
    return { success: false, error: 'unresolved_nn', count: unresolvedCount };
  }

  await db.update(subgroups)
    .set({ estado: 'finalizada' })
    .where(eq(subgroups.id, subgrupoId));

  notifyDataChanged();
  return { success: true };
}

// Ownership guard — inline in screens before showing edit UI
export function canEdit(subgroup: { usuarioCreador: string; estado: SubGroupEstado }, userId: string): boolean {
  if (subgroup.estado === 'sincronizada') return false;
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
 * Only works for 'finalizada' state, not 'sincronizada'.
 */
export async function reactivateSubGroup(id: string): Promise<void> {
  await db.update(subgroups)
    .set({ estado: 'activa' })
    .where(eq(subgroups.id, id));
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
