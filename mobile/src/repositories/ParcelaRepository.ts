/**
 * ParcelaRepository — CRUD + soft-delete tombstone de parcelas.
 * Valida nombre/codigo únicos por plantación (excluye tombstones) y descripcion ≤10k; bloquea
 * delete si hay grupos hijos. Lecturas filtran deleted_at IS NULL salvo `{ includeDeleted: true }`
 * (uso interno de sync); sin columna usuarioCreador, la auditoría es server-side.
 */
import { db } from '../database/client';
import { parcelas, groups } from '../database/schema';
import { eq, and, asc, count, isNull, sql } from 'drizzle-orm';
import { notifyDataChanged } from '../database/liveQuery';
import * as Crypto from 'expo-crypto';
import { localNow } from '../utils/dateUtils';
import { isUniqueConstraintError } from '../database/sqliteErrors';

const MAX_DESCRIPCION_LENGTH = 10000;

export interface Parcela {
  id: string;
  plantacionId: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  pendingSync: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

type DuplicateError = 'codigo_duplicate' | 'nombre_duplicate' | 'both_duplicate';
type DescripcionError = 'descripcion_too_long';

export type CreateParcelaResult =
  | { success: true; id: string }
  | { success: false; error: DuplicateError | DescripcionError | 'unknown' };

export type UpdateParcelaResult =
  | { success: true }
  | { success: false; error: DuplicateError | DescripcionError | 'not_found' | 'unknown' };

export type DeleteParcelaResult =
  | { deleted: true }
  | { deleted: false; error: 'has_children'; childCount: number }
  | { deleted: false; error: 'not_found' };

export type RestoreParcelaResult =
  | { restored: true }
  | { restored: false; error: 'not_found' | DuplicateError };

/** Valida nombre/codigo únicos en la plantación, excluyendo tombstones — un nombre reusado de una parcela tombstoned es válido. */
async function validateParcelaUniqueness(
  plantacionId: string,
  nombre: string,
  codigo: string,
  excludeId?: string,
): Promise<DuplicateError | null> {
  const baseConds = [eq(parcelas.plantacionId, plantacionId), isNull(parcelas.deletedAt)];
  const nombreConds = [...baseConds, eq(parcelas.nombre, nombre)];
  const codigoConds = [...baseConds, eq(parcelas.codigo, codigo)];
  if (excludeId) {
    nombreConds.push(sql`${parcelas.id} != ${excludeId}`);
    codigoConds.push(sql`${parcelas.id} != ${excludeId}`);
  }
  const [existingNombre] = await db.select({ id: parcelas.id }).from(parcelas)
    .where(and(...nombreConds)).limit(1);
  const [existingCodigo] = await db.select({ id: parcelas.id }).from(parcelas)
    .where(and(...codigoConds)).limit(1);
  if (existingNombre && existingCodigo) return 'both_duplicate';
  if (existingNombre) return 'nombre_duplicate';
  if (existingCodigo) return 'codigo_duplicate';
  return null;
}

/** Returns 'descripcion_too_long' if length > MAX_DESCRIPCION_LENGTH, else null. */
function validateDescripcion(descripcion?: string | null): DescripcionError | null {
  if (descripcion && descripcion.length > MAX_DESCRIPCION_LENGTH) {
    return 'descripcion_too_long';
  }
  return null;
}

/** Busca una parcela por id; oculta tombstones salvo `opts.includeDeleted` (uso interno de sync). */
export async function findById(
  id: string,
  opts?: { includeDeleted?: boolean },
): Promise<Parcela | null> {
  const conds = [eq(parcelas.id, id)];
  if (!opts?.includeDeleted) conds.push(isNull(parcelas.deletedAt));
  const [row] = await db.select().from(parcelas).where(and(...conds)).limit(1);
  return (row ?? null) as Parcela | null;
}

/** Lists active (non-tombstoned) parcelas for a plantation, ordered by createdAt ASC. */
export async function findByPlantacion(plantacionId: string): Promise<Parcela[]> {
  return db.select().from(parcelas)
    .where(and(eq(parcelas.plantacionId, plantacionId), isNull(parcelas.deletedAt)))
    .orderBy(asc(parcelas.createdAt)) as unknown as Promise<Parcela[]>;
}

export async function createParcela(params: {
  plantacionId: string;
  nombre: string;
  codigo: string;
  descripcion?: string | null;
}): Promise<CreateParcelaResult> {
  const upperCodigo = params.codigo.toUpperCase();
  const descripcionError = validateDescripcion(params.descripcion);
  if (descripcionError) return { success: false, error: descripcionError };
  const dup = await validateParcelaUniqueness(params.plantacionId, params.nombre, upperCodigo);
  if (dup) return { success: false, error: dup };
  try {
    const id = Crypto.randomUUID();
    const now = localNow();
    await db.insert(parcelas).values({
      id,
      plantacionId: params.plantacionId,
      nombre: params.nombre,
      codigo: upperCodigo,
      descripcion: params.descripcion ?? null,
      pendingSync: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
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

export async function updateParcela(
  id: string,
  params: { nombre: string; codigo: string; descripcion?: string | null },
): Promise<UpdateParcelaResult> {
  const upperCodigo = params.codigo.toUpperCase();
  const existing = await findById(id);
  if (!existing) return { success: false, error: 'not_found' };
  const descripcionError = validateDescripcion(params.descripcion);
  if (descripcionError) return { success: false, error: descripcionError };
  const dup = await validateParcelaUniqueness(existing.plantacionId, params.nombre, upperCodigo, id);
  if (dup) return { success: false, error: dup };
  await db.update(parcelas)
    .set({
      nombre: params.nombre,
      codigo: upperCodigo,
      descripcion: params.descripcion ?? null,
      pendingSync: true,
      updatedAt: localNow(),
    })
    .where(eq(parcelas.id, id));
  notifyDataChanged();
  return { success: true };
}

/** Counts active groups (any) referencing this parcela. */
async function countChildGroups(parcelaId: string): Promise<number> {
  const [row] = await db.select({ cnt: count() }).from(groups)
    .where(eq(groups.parcelaId, parcelaId));
  return row?.cnt ?? 0;
}

/** Soft-delete (tombstone) de una parcela; bloqueado si tiene grupos hijos. Idempotente: un segundo delete sobre una parcela ya tombstoned retorna not_found. */
export async function deleteParcela(id: string): Promise<DeleteParcelaResult> {
  const existing = await findById(id);
  if (!existing) return { deleted: false, error: 'not_found' };
  const childCount = await countChildGroups(id);
  if (childCount > 0) {
    return { deleted: false, error: 'has_children', childCount };
  }
  const now = localNow();
  await db.update(parcelas)
    .set({ deletedAt: now, pendingSync: true, updatedAt: now })
    .where(eq(parcelas.id, id));
  notifyDataChanged();
  return { deleted: true };
}

/** Restaura una parcela tombstoned (sync conflict recovery); valida que ninguna parcela activa tenga el mismo nombre/codigo en la plantación (pudo tomar su lugar mientras estaba tombstoned). */
export async function restoreParcela(id: string): Promise<RestoreParcelaResult> {
  const existing = await findById(id, { includeDeleted: true });
  if (!existing || existing.deletedAt === null) {
    return { restored: false, error: 'not_found' };
  }
  const dup = await validateParcelaUniqueness(
    existing.plantacionId, existing.nombre, existing.codigo, id,
  );
  if (dup) return { restored: false, error: dup };
  await db.update(parcelas)
    .set({ deletedAt: null, pendingSync: true, updatedAt: localNow() })
    .where(eq(parcelas.id, id));
  notifyDataChanged();
  return { restored: true };
}

/** Marks parcela as dirty (pending sync) without changing other fields. */
export async function markParcelaPendingSync(id: string): Promise<void> {
  await db.update(parcelas)
    .set({ pendingSync: true, updatedAt: localNow() })
    .where(eq(parcelas.id, id));
  notifyDataChanged();
}

/** Limpia pendingSync tras sync exitoso; aplica a parcelas activas y tombstoned (el tombstone persiste local, solo se limpia el flag). */
export async function markParcelaSynced(id: string): Promise<void> {
  await db.update(parcelas)
    .set({ pendingSync: false })
    .where(eq(parcelas.id, id));
  notifyDataChanged();
}

/** Parcelas con pendingSync=true, INCLUYE tombstoned para que el delete-as-sync se propague al server. */
export async function getSyncableParcelas(plantacionId: string): Promise<Parcela[]> {
  const rows = await db.select().from(parcelas)
    .where(and(eq(parcelas.plantacionId, plantacionId), eq(parcelas.pendingSync, true)));
  return rows as unknown as Parcela[];
}
