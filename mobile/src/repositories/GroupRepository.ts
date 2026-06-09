import { db } from '../database/client';
import { groups, trees, parcelas, species as speciesTable } from '../database/schema';
import { eq, and, desc, count, asc, sql } from 'drizzle-orm';
import { notifyDataChanged } from '../database/liveQuery';
import * as Crypto from 'expo-crypto';
import { localNow } from '../utils/dateUtils';
import { generateSubId } from '../utils/idGenerator';
import type { GroupTipo } from '../constants/groupTipo';

export type GroupEstado = 'activa' | 'finalizada' | 'sincronizada';
export type { GroupTipo };

export interface Group {
  id: string;
  plantacionId: string;
  parcelaId?: string | null;
  nombre: string;
  codigo: string;
  tipo: GroupTipo;
  estado: GroupEstado;
  usuarioCreador: string;
  createdAt: string;
  pendingSync: boolean;
}

/**
 * Devuelve el `codigo` de parcela del grupo — primer segmento del SubID
 * (`{parcelaCodigo}{grupoCodigo}{especieCodigo}{posicion}`). Todo grupo tiene
 * parcela con código: la ausencia es un dato inválido, no un caso válido, así
 * que se lanza error (no se degrada a ''). Issue #59.
 */
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

// Returns the nombre of the most recently created Group for this plantation.
export async function getLastGroupName(plantacionId: string): Promise<string | null> {
  const rows = await db.select({ nombre: groups.nombre })
    .from(groups)
    .where(eq(groups.plantacionId, plantacionId))
    .orderBy(desc(groups.createdAt))
    .limit(1);
  return rows[0]?.nombre ?? null;
}

type DuplicateError = 'codigo_duplicate' | 'nombre_duplicate' | 'both_duplicate';

/**
 * Validates that nombre and codigo are unique. Scope is per-parcela when
 * parcelaId is provided; falls back to per-plantacion when parcelaId is
 * null/undefined (legacy or transitional rows).
 */
function buildScopeConds(plantacionId: string, parcelaId: string | null | undefined) {
  if (parcelaId) return [eq(groups.parcelaId, parcelaId)];
  return [eq(groups.plantacionId, plantacionId)];
}

async function validateGroupUniqueness(
  plantacionId: string,
  parcelaId: string | null | undefined,
  nombre: string,
  codigo: string,
  excludeId?: string,
): Promise<DuplicateError | null> {
  if (!parcelaId) {
    console.warn('grupo sin parcelaId — validación per-plantacion (fallback legacy)');
  }
  const scope = buildScopeConds(plantacionId, parcelaId);
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
  parcelaId?: string | null;
  nombre: string;
  codigo: string;
  tipo: GroupTipo;
  usuarioCreador: string;
}): Promise<CreateGroupResult> {
  const upperCodigo = params.codigo.toUpperCase();

  const duplicateError = await validateGroupUniqueness(
    params.plantacionId,
    params.parcelaId ?? null,
    params.nombre,
    upperCodigo,
  );
  if (duplicateError) return { success: false, error: duplicateError };

  try {
    const id = Crypto.randomUUID();
    await db.insert(groups).values({
      id,
      plantacionId: params.plantacionId,
      parcelaId: params.parcelaId ?? null,
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

// Marks a group as having pending local changes (dirty flag).
export async function markGroupPendingSync(grupoId: string): Promise<void> {
  await db.update(groups)
    .set({ pendingSync: true })
    .where(eq(groups.id, grupoId));
}

// Marks a group as synced after successful server sync.
export async function markGroupSynced(grupoId: string): Promise<void> {
  // Solo limpiamos pendingSync (la marca real de "sincronizado"). NO pisamos el
  // estado: forzarlo a 'sincronizada' corrompía el estado real (un grupo 'activa'
  // quedaba marcado como hecho y dejaba de bloquear la finalización) y divergía
  // del server, que guarda el estado real ('activa'|'finalizada'). Ver issue #60.
  await db.update(groups)
    .set({ pendingSync: false })
    .where(eq(groups.id, grupoId));
  notifyDataChanged();
}

// Finalizes a Group (activa → finalizada). N/N trees are allowed: un grupo se
// puede sincronizar con N/N sin resolver — los resuelve después cualquier
// usuario (admin o técnico) tras descargarlo. NO hay gate de N/N en el sync.
export async function finalizeGroup(grupoId: string): Promise<{ success: true }> {
  await db.update(groups)
    .set({ estado: 'finalizada' })
    .where(eq(groups.id, grupoId));

  await markGroupPendingSync(grupoId);
  notifyDataChanged();
  return { success: true };
}

// Ownership guard — inline in screens before showing edit UI.
export function canEdit(
  group: { usuarioCreador: string },
  userId: string,
  plantacionEstado: string
): boolean {
  if (plantacionEstado === 'finalizada') return false;
  return group.usuarioCreador === userId;
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
    current.plantacionId,
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

/**
 * Helper: recalculates all tree subIds for a group inside a tx.
 */
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
    let especieCodigo = 'NN';
    if (tree.especieId) {
      const [sp] = await tx.select({ codigo: speciesTable.codigo })
        .from(speciesTable)
        .where(eq(speciesTable.id, tree.especieId));
      especieCodigo = sp?.codigo ?? 'NN';
    }
    const newSubId = generateSubId(parcelaCodigo, newCodigo.toUpperCase(), especieCodigo, tree.posicion);
    await tx.update(trees)
      .set({ subId: newSubId })
      .where(eq(trees.id, tree.id));
  }
}

/**
 * Updates group codigo and recalculates all tree subIds in a transaction.
 */
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
 * Reactivates a finalized group back to 'activa' state.
 */
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

// Returns all finalizada groups for a plantation (pending sync).
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

// Returns groups with pendingSync=true that are ready to sync.
export async function getSyncableGroups(plantacionId: string, _userId?: string): Promise<Group[]> {
  const conditions = [
    eq(groups.plantacionId, plantacionId),
    eq(groups.pendingSync, true),
  ];
  return db.select().from(groups).where(and(...conditions)) as unknown as Group[];
}

// Returns total count of groups with pendingSync=true across all plantations.
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
