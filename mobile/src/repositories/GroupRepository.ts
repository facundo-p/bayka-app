import { db } from '../database/client';
import { groups, trees, parcelas } from '../database/schema';
import { eq, and, desc, count, asc, sql } from 'drizzle-orm';
import { notifyDataChanged } from '../database/liveQuery';
import * as Crypto from 'expo-crypto';
import { localNow } from '../utils/dateUtils';
import { generateSubId } from '../utils/idGenerator';
import { resolveEspecieCodigo } from '../utils/speciesHelpers';
import { getTreeEditGating } from '../utils/treeEditGating';
import { isUniqueConstraintError, isNameUniqueConstraintError } from '../database/sqliteErrors';
import type { GroupTipo } from '../constants/groupTipo';

export type GroupEstado = 'activa' | 'finalizada' | 'sincronizada';
export type { GroupTipo };

export interface Group {
  id: string;
  plantacionId: string;
  /** Parcela obligatoria (#90): la ausencia es dato inválido. */
  parcelaId: string;
  nombre: string;
  codigo: string;
  tipo: GroupTipo;
  estado: GroupEstado;
  usuarioCreador: string;
  createdAt: string;
  pendingSync: boolean;
}

/** Codigo de parcela del grupo (primer segmento del SubID); toda parcela lo tiene — sin código, lanza en vez de degradar a '' (#59). */
export async function getGroupParcelaCodigo(grupoId: string): Promise<string> {
  const [group] = await db.select({ parcelaId: groups.parcelaId })
    .from(groups)
    .where(eq(groups.id, grupoId));
  if (!group?.parcelaId) {
    throw new Error(`Grupo ${grupoId} sin parcela: dato inválido, corregir antes de registrar árboles.`);
  }
  const [parcela] = await db.select({ codigo: parcelas.codigo })
    .from(parcelas)
    .where(eq(parcelas.id, group.parcelaId));
  if (!parcela?.codigo) {
    throw new Error(`Parcela ${group.parcelaId} (grupo ${grupoId}) sin código: dato inválido.`);
  }
  return parcela.codigo;
}

export async function getLastGroupName(plantacionId: string): Promise<string | null> {
  const rows = await db.select({ nombre: groups.nombre })
    .from(groups)
    .where(eq(groups.plantacionId, plantacionId))
    .orderBy(desc(groups.createdAt))
    .limit(1);
  return rows[0]?.nombre ?? null;
}

type DuplicateError = 'codigo_duplicate' | 'nombre_duplicate' | 'both_duplicate';

/** Valida nombre/codigo únicos dentro de la parcela del grupo (#90: parcela obligatoria, sin fallback per-plantación). */
async function validateGroupUniqueness(
  parcelaId: string,
  nombre: string,
  codigo: string,
  excludeId?: string,
): Promise<DuplicateError | null> {
  const scope = [eq(groups.parcelaId, parcelaId)];
  const nombreConds = [...scope, eq(groups.nombre, nombre)];
  const codigoConds = [...scope, eq(groups.codigo, codigo)];
  if (excludeId) {
    nombreConds.push(sql`${groups.id} != ${excludeId}`);
    codigoConds.push(sql`${groups.id} != ${excludeId}`);
  }
  const [existingNombre] = await db.select({ id: groups.id }).from(groups).where(and(...nombreConds)).limit(1);
  const [existingCodigo] = await db.select({ id: groups.id }).from(groups).where(and(...codigoConds)).limit(1);
  if (existingNombre && existingCodigo) return 'both_duplicate';
  if (existingNombre) return 'nombre_duplicate';
  if (existingCodigo) return 'codigo_duplicate';
  return null;
}

export type CreateGroupResult =
  | { success: true; id: string }
  | { success: false; error: 'codigo_duplicate' | 'nombre_duplicate' | 'both_duplicate' | 'unknown' };

export async function createGroup(params: {
  plantacionId: string;
  parcelaId: string;
  nombre: string;
  codigo: string;
  tipo: GroupTipo;
  usuarioCreador: string;
}): Promise<CreateGroupResult> {
  const upperCodigo = params.codigo.toUpperCase();

  const duplicateError = await validateGroupUniqueness(
    params.parcelaId,
    params.nombre,
    upperCodigo,
  );
  if (duplicateError) return { success: false, error: duplicateError };

  try {
    const id = Crypto.randomUUID();
    await db.insert(groups).values({
      id,
      plantacionId: params.plantacionId,
      parcelaId: params.parcelaId,
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
    if (isUniqueConstraintError(e)) {
      return { success: false, error: 'codigo_duplicate' };
    }
    return { success: false, error: 'unknown' };
  }
}

export async function markGroupPendingSync(grupoId: string): Promise<void> {
  await db.update(groups)
    .set({ pendingSync: true })
    .where(eq(groups.id, grupoId));
}

export async function markGroupSynced(grupoId: string): Promise<void> {
  // Solo limpia pendingSync: forzar estado a 'sincronizada' corrompía el estado real (un grupo
  // 'activa' dejaba de bloquear la finalización) y divergía del server (#60).
  await db.update(groups)
    .set({ pendingSync: false })
    .where(eq(groups.id, grupoId));
  notifyDataChanged();
}

// activa → finalizada. N/N sin resolver puede sincronizar: cualquier usuario lo resuelve después de descargarlo; no hay gate de N/N en el sync.
export async function finalizeGroup(grupoId: string): Promise<{ success: true }> {
  await db.update(groups)
    .set({ estado: 'finalizada' })
    .where(eq(groups.id, grupoId));

  await markGroupPendingSync(grupoId);
  notifyDataChanged();
  return { success: true };
}

// Ownership guard inline en screens; delega a treeEditGating (#155) — subgroupEstado no afecta canEdit ahí, solo canDelete.
export function canEdit(
  group: { usuarioCreador: string },
  userId: string,
  plantacionEstado: string
): boolean {
  return getTreeEditGating({
    plantacionEstado,
    subgroupEstado: 'activa',
    isCreator: group.usuarioCreador === userId,
  }).canEdit;
}

export type UpdateGroupResult =
  | { success: true }
  | { success: false; error: 'codigo_duplicate' | 'nombre_duplicate' | 'both_duplicate' | 'unknown' };

export async function updateGroup(
  id: string,
  params: { nombre: string; codigo: string; tipo: GroupTipo }
): Promise<UpdateGroupResult> {
  const upperCodigo = params.codigo.toUpperCase();

  const [current] = await db.select({ plantacionId: groups.plantacionId, parcelaId: groups.parcelaId })
    .from(groups).where(eq(groups.id, id));
  if (!current) return { success: false, error: 'unknown' };

  const duplicateError = await validateGroupUniqueness(
    current.parcelaId,
    params.nombre,
    upperCodigo,
    id,
  );
  if (duplicateError) return { success: false, error: duplicateError };

  await db.update(groups)
    .set({
      nombre: params.nombre,
      codigo: upperCodigo,
      tipo: params.tipo,
    })
    .where(eq(groups.id, id));
  await markGroupPendingSync(id);
  notifyDataChanged();
  return { success: true };
}

/** Recalculates all tree subIds for a group inside a tx. */
async function recalcTreesSubIds(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  grupoId: string,
  newCodigo: string,
  parcelaCodigo: string
): Promise<void> {
  const allTrees = await tx.select().from(trees)
    .where(eq(trees.groupId, grupoId))
    .orderBy(asc(trees.posicion));

  for (const tree of allTrees) {
    const especieCodigo = await resolveEspecieCodigo(tx, tree.especieId);
    const newSubId = generateSubId(parcelaCodigo, newCodigo.toUpperCase(), especieCodigo, tree.posicion);
    await tx.update(trees)
      .set({ subId: newSubId })
      .where(eq(trees.id, tree.id));
  }
}

/** Updates group codigo and recalculates all tree subIds in a transaction. */
export async function updateGroupCode(
  id: string,
  newCodigo: string,
  _oldCodigo: string
): Promise<UpdateGroupResult> {
  const upperCodigo = newCodigo.toUpperCase();

  const [current] = await db.select({ plantacionId: groups.plantacionId, parcelaId: groups.parcelaId })
    .from(groups).where(eq(groups.id, id));
  if (!current) return { success: false, error: 'unknown' };

  // Per-parcela uniqueness; fallback to per-plantacion if legacy row has no parcelaId.
  const scopeCond = current.parcelaId
    ? eq(groups.parcelaId, current.parcelaId)
    : eq(groups.plantacionId, current.plantacionId);
  const [existingCodigo] = await db.select({ id: groups.id })
    .from(groups)
    .where(and(scopeCond, eq(groups.codigo, upperCodigo), sql`${groups.id} != ${id}`))
    .limit(1);
  if (existingCodigo) return { success: false, error: 'codigo_duplicate' };

  const parcelaCodigo = await getGroupParcelaCodigo(id);

  try {
    await db.transaction(async (tx) => {
      await tx.update(groups)
        .set({ codigo: upperCodigo })
        .where(eq(groups.id, id));
      await recalcTreesSubIds(tx, id, newCodigo, parcelaCodigo);
    });
    await markGroupPendingSync(id);
    notifyDataChanged();
    return { success: true };
  } catch (e: any) {
    if (isUniqueConstraintError(e)) {
      if (isNameUniqueConstraintError(e)) {
        return { success: false, error: 'nombre_duplicate' };
      }
      return { success: false, error: 'codigo_duplicate' };
    }
    return { success: false, error: 'unknown' };
  }
}

/** Reactivates a finalized group back to 'activa' state. */
export async function reactivateGroup(id: string): Promise<void> {
  await db.update(groups)
    .set({ estado: 'activa' })
    .where(eq(groups.id, id));
  await markGroupPendingSync(id);
  notifyDataChanged();
}

export async function deleteGroup(grupoId: string): Promise<{ deleted: boolean; treeCount: number }> {
  const [treeResult] = await db.select({ count: count() })
    .from(trees)
    .where(eq(trees.groupId, grupoId));

  const treeCount = treeResult?.count ?? 0;

  await db.delete(trees).where(eq(trees.groupId, grupoId));
  await db.delete(groups).where(eq(groups.id, grupoId));

  notifyDataChanged();
  return { deleted: true, treeCount };
}

export async function getFinalizadaGroups(plantacionId: string, userId?: string): Promise<Group[]> {
  const conditions = [
    eq(groups.plantacionId, plantacionId),
    eq(groups.estado, 'finalizada'),
  ];
  if (userId) {
    conditions.push(eq(groups.usuarioCreador, userId));
  }
  return db.select().from(groups)
    .where(and(...conditions)) as unknown as Group[];
}

export async function getSyncableGroups(plantacionId: string, _userId?: string): Promise<Group[]> {
  const conditions = [
    eq(groups.plantacionId, plantacionId),
    eq(groups.pendingSync, true),
  ];
  return db.select().from(groups).where(and(...conditions)) as unknown as Group[];
}

export async function getPendingSyncCount(userId?: string): Promise<number> {
  const conditions = [eq(groups.pendingSync, true)];
  if (userId) {
    conditions.push(eq(groups.usuarioCreador, userId));
  }
  const result = await db.select({ cnt: count() })
    .from(groups)
    .where(and(...conditions));
  return result[0]?.cnt ?? 0;
}
