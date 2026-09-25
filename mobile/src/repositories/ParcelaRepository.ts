/**
 * ParcelaRepository — CRUD + soft-delete tombstone de parcelas.
 * Valida nombre/codigo únicos por plantación (excluye tombstones) y descripcion ≤10k; bloquea
 * delete si hay grupos hijos. Lecturas filtran deleted_at IS NULL salvo `{ includeDeleted: true }`
 * (uso interno de sync); sin columna usuarioCreador, la auditoría es server-side. Cambiar el
 * código reescribe el SubID de los árboles de sus grupos (#623). Crear es de cualquier miembro;
 * editar, borrar y restaurar, solo de admin y superadmin (#640), salvo el alta propia que todavía
 * no subió, que su creador edita y borra (#654).
 */
import { db } from '../database/client';
import { enTransaccion } from '../database/transaccion';
import { parcelas, groups } from '../database/schema';
import { recalcularSubIdsDeLaParcela } from './subIdsDeArboles';
import { plantacionEditablePorId } from '../queries/estadoDeEdicionQueries';
import {
  ERROR_DE_DUPLICADO, ERROR_DE_EDICION, type ErrorDeDuplicado, type ErrorDeEdicion,
} from '../constants/errorDeEdicion';
import { eq, and, asc, count, isNull, sql } from 'drizzle-orm';
import { notifyDataChanged } from '../database/liveQuery';
import * as Crypto from 'expo-crypto';
import { localNow } from '../utils/dateUtils';
import { errorDeDuplicado } from '../database/sqliteErrors';
import { readCachedRole, readCachedUserId } from '../supabase/auth';
import { esRolAdmin } from '../types/domain';
import { puedeEditarParcela, type EditorDeParcela } from '../utils/permisosDeEdicion';

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
  /** Solo local: quién la creó acá mientras su alta no llegó al servidor (#654). */
  altaPendienteDe: string | null;
}

type DescripcionError = 'descripcion_too_long';

export type CreateParcelaResult =
  | { success: true; id: string }
  | { success: false; error: ErrorDeDuplicado | DescripcionError | 'unknown' };

export type UpdateParcelaResult =
  | { success: true }
  | { success: false; error: ErrorDeDuplicado | DescripcionError | ErrorDeEdicion | 'not_found' | 'unknown' };

type SinPermiso = typeof ERROR_DE_EDICION.sinPermiso;

export type DeleteParcelaResult =
  | { deleted: true }
  | { deleted: false; error: 'has_children'; childCount: number }
  | { deleted: false; error: 'not_found' | SinPermiso };

export type RestoreParcelaResult =
  | { restored: true }
  | { restored: false; error: 'not_found' | ErrorDeDuplicado | SinPermiso };

/** Editar y borrar parcelas que el servidor ya tiene es de admin y superadmin; la RLS exige lo mismo. */
export async function puedeEditarParcelas(): Promise<boolean> {
  return esRolAdmin(await readCachedRole());
}

async function editorActual(): Promise<EditorDeParcela> {
  return { esAdmin: await puedeEditarParcelas(), userId: await readCachedUserId() };
}

/** Sin alta pendiente el servidor ya la tiene: borrarla necesita tombstone. */
function nuncaSubida(parcela: Parcela): boolean {
  return parcela.altaPendienteDe != null;
}

/** Valida nombre/codigo únicos en la plantación, excluyendo tombstones — un nombre reusado de una parcela tombstoned es válido. */
async function validateParcelaUniqueness(
  plantacionId: string,
  nombre: string,
  codigo: string,
  excludeId?: string,
): Promise<ErrorDeDuplicado | null> {
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
  if (existingNombre && existingCodigo) return ERROR_DE_DUPLICADO.ambos;
  if (existingNombre) return ERROR_DE_DUPLICADO.nombre;
  if (existingCodigo) return ERROR_DE_DUPLICADO.codigo;
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
      altaPendienteDe: await readCachedUserId(),
    });
    notifyDataChanged();
    return { success: true, id };
  } catch (e: unknown) {
    return { success: false, error: errorDeDuplicado(e) };
  }
}

type CamposDeParcela = { nombre: string; codigo: string; descripcion?: string | null };
type ErrorDeUpdate = Extract<UpdateParcelaResult, { success: false }>['error'];

export async function updateParcela(id: string, params: CamposDeParcela): Promise<UpdateParcelaResult> {
  const campos = { ...params, codigo: params.codigo.toUpperCase() };
  const existing = await findById(id);
  if (!existing) return { success: false, error: 'not_found' };
  if (!puedeEditarParcela(existing, await editorActual())) return { success: false, error: ERROR_DE_EDICION.sinPermiso };
  const invalido = await validarEdicion(existing, campos);
  if (invalido) return { success: false, error: invalido };
  try {
    await enTransaccion((tx) => escribirParcela(tx, existing, campos));
  } catch (e: unknown) {
    return { success: false, error: errorDeDuplicado(e) };
  }
  notifyDataChanged();
  return { success: true };
}

async function validarEdicion(actual: Parcela, campos: CamposDeParcela): Promise<ErrorDeUpdate | null> {
  if (!(await plantacionEditablePorId(actual.plantacionId))) return ERROR_DE_EDICION.plantacionNoEditable;
  return validateDescripcion(campos.descripcion)
    ?? validateParcelaUniqueness(actual.plantacionId, campos.nombre, campos.codigo, actual.id);
}

async function escribirParcela(tx: typeof db, actual: Parcela, campos: CamposDeParcela): Promise<void> {
  await tx.update(parcelas)
    .set({
      nombre: campos.nombre,
      codigo: campos.codigo,
      descripcion: campos.descripcion ?? null,
      pendingSync: true,
      updatedAt: localNow(),
    })
    .where(eq(parcelas.id, actual.id));
  if (campos.codigo !== actual.codigo) {
    await recalcularSubIdsDeLaParcela(tx, actual.id, { anterior: actual.codigo, nuevo: campos.codigo });
  }
}

/** Counts active groups (any) referencing this parcela. */
async function countChildGroups(parcelaId: string): Promise<number> {
  const [row] = await db.select({ cnt: count() }).from(groups)
    .where(eq(groups.parcelaId, parcelaId));
  return row?.cnt ?? 0;
}

/**
 * Borra una parcela sin grupos hijos. La que nunca subió se borra del dispositivo; la que el
 * servidor ya tiene queda como tombstone para que el push propague el borrado. Idempotente:
 * un segundo delete retorna not_found.
 */
export async function deleteParcela(id: string): Promise<DeleteParcelaResult> {
  const existing = await findById(id);
  if (!existing) return { deleted: false, error: 'not_found' };
  if (!puedeEditarParcela(existing, await editorActual())) return { deleted: false, error: ERROR_DE_EDICION.sinPermiso };
  const childCount = await countChildGroups(id);
  if (childCount > 0) {
    return { deleted: false, error: 'has_children', childCount };
  }
  if (nuncaSubida(existing)) await db.delete(parcelas).where(eq(parcelas.id, id));
  else await marcarTombstone(id);
  notifyDataChanged();
  return { deleted: true };
}

async function marcarTombstone(id: string): Promise<void> {
  const now = localNow();
  await db.update(parcelas)
    .set({ deletedAt: now, pendingSync: true, updatedAt: now })
    .where(eq(parcelas.id, id));
}

/** Restaura una parcela tombstoned (sync conflict recovery); valida que ninguna parcela activa tenga el mismo nombre/codigo en la plantación (pudo tomar su lugar mientras estaba tombstoned). */
export async function restoreParcela(id: string): Promise<RestoreParcelaResult> {
  if (!(await puedeEditarParcelas())) return { restored: false, error: ERROR_DE_EDICION.sinPermiso };
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

/** Limpia pendingSync y el alta pendiente tras el push; aplica a parcelas activas y tombstoned (el tombstone persiste local). */
export async function markParcelaSynced(id: string): Promise<void> {
  await db.update(parcelas)
    .set({ pendingSync: false, altaPendienteDe: null })
    .where(eq(parcelas.id, id));
  notifyDataChanged();
}

/** Parcelas con pendingSync=true, INCLUYE tombstoned para que el delete-as-sync se propague al server. */
export async function getSyncableParcelas(plantacionId: string): Promise<Parcela[]> {
  const rows = await db.select().from(parcelas)
    .where(and(eq(parcelas.plantacionId, plantacionId), eq(parcelas.pendingSync, true)));
  return rows as unknown as Parcela[];
}
