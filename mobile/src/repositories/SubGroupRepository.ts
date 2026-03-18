import { db } from '../database/client';
import { subgroups, trees } from '../database/schema';
import { eq, and, desc, isNull, count } from 'drizzle-orm';
import { notifyDataChanged } from '../database/liveQuery';
import * as Crypto from 'expo-crypto';
import { localNow } from '../utils/dateUtils';

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

export type CreateSubGroupResult =
  | { success: true; id: string }
  | { success: false; error: 'codigo_duplicate' | 'unknown' };

export async function createSubGroup(params: {
  plantacionId: string;
  nombre: string;
  codigo: string;
  tipo: SubGroupTipo;
  usuarioCreador: string;
}): Promise<CreateSubGroupResult> {
  try {
    const id = Crypto.randomUUID();
    await db.insert(subgroups).values({
      id,
      plantacionId: params.plantacionId,
      nombre: params.nombre,
      codigo: params.codigo.toUpperCase(),
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
