/**
 * Técnicos de una plantación (#636). Asignar se aplica en `plantation_users` en el
 * momento y queda anotado hasta que el server lo acepta; quitar es solo online, así
 * que se refleja acá recién cuando el server respondió.
 */
import { db } from '../database/client';
import { enTransaccion } from '../database/transaccion';
import { altasDeTecnicosPendientes, plantationUsers, plantations, tecnicosDeOrganizacion } from '../database/schema';
import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import { ROL } from '../constants/roles';
import { localNow } from '../utils/dateUtils';

/** Ejecutor drizzle: el cliente `db` o una transacción `tx`. */
type DbExecutor = Pick<typeof db, 'insert' | 'delete' | 'select' | 'update'>;

/** Asigna en el teléfono y lo anota para subir. */
export async function guardarAltasDeTecnicos(plantacionId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const asignadoEn = localNow();
  await enTransaccion(async (tx) => {
    await tx.insert(plantationUsers)
      .values(userIds.map((userId) => ({ plantationId: plantacionId, userId, rolEnPlantacion: ROL.tecnico, assignedAt: asignadoEn })))
      .onConflictDoNothing();
    await tx.insert(altasDeTecnicosPendientes)
      .values(userIds.map((userId) => ({ plantacionId, userId, asignadoEn })))
      .onConflictDoNothing();
  });
}

async function descartarPendientes(exec: DbExecutor, plantacionId: string, userIds: string[]): Promise<void> {
  await exec.delete(altasDeTecnicosPendientes).where(and(
    eq(altasDeTecnicosPendientes.plantacionId, plantacionId),
    inArray(altasDeTecnicosPendientes.userId, userIds),
  ));
}

/** Saca la asignación del teléfono, pendiente o no. Las membresías admin no se tocan. */
export async function quitarTecnicosLocal(plantacionId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await enTransaccion(async (tx) => {
    await tx.delete(plantationUsers).where(and(
      eq(plantationUsers.plantationId, plantacionId),
      eq(plantationUsers.rolEnPlantacion, ROL.tecnico),
      inArray(plantationUsers.userId, userIds),
    ));
    await descartarPendientes(tx, plantacionId, userIds);
  });
}

export async function getAltasPendientes(plantacionId: string): Promise<string[]> {
  const filas = await db
    .select({ userId: altasDeTecnicosPendientes.userId })
    .from(altasDeTecnicosPendientes)
    .where(eq(altasDeTecnicosPendientes.plantacionId, plantacionId));
  return filas.map((f) => f.userId);
}

/**
 * Registra la respuesta del server: lo aceptado deja de estar pendiente y lo
 * rechazado se quita del teléfono.
 */
export async function registrarAltasSubidas(plantacionId: string, enviadas: string[], rechazadas: string[]): Promise<void> {
  const aceptadas = enviadas.filter((id) => !rechazadas.includes(id));
  await quitarTecnicosLocal(plantacionId, rechazadas);
  if (aceptadas.length > 0) await descartarPendientes(db, plantacionId, aceptadas);
}

const plantacionSubida = and(eq(plantations.pendingSync, false), isNull(plantations.eliminadaEnServidorEn));

/** Plantaciones con altas para subir: ni sin subir (esperan a su alta) ni eliminadas en el server. */
export async function getPlantacionesConAltasDeTecnicos(): Promise<{ id: string; lugar: string }[]> {
  return db
    .selectDistinct({ id: plantations.id, lugar: plantations.lugar })
    .from(altasDeTecnicosPendientes)
    .innerJoin(plantations, eq(plantations.id, altasDeTecnicosPendientes.plantacionId))
    .where(plantacionSubida);
}

/** El server ya la tiene: sus altas pueden subir. */
export async function admiteSubirTecnicos(plantacionId: string): Promise<boolean> {
  const filas = await db.select({ id: plantations.id }).from(plantations)
    .where(and(eq(plantations.id, plantacionId), plantacionSubida));
  return filas.length > 0;
}

export async function countAltasDeTecnicos(plantacionId: string): Promise<number> {
  const [fila] = await db
    .select({ cnt: count() })
    .from(altasDeTecnicosPendientes)
    .where(eq(altasDeTecnicosPendientes.plantacionId, plantacionId));
  return fila?.cnt ?? 0;
}

export async function borrarAltasDeTecnicosDePlantacion(exec: DbExecutor, plantacionId: string): Promise<void> {
  await exec.delete(altasDeTecnicosPendientes).where(eq(altasDeTecnicosPendientes.plantacionId, plantacionId));
}

// ─── Caché de técnicos de la organización ────────────────────────────────────

export type TecnicoDeOrganizacion = { id: string; organizacionId: string; nombre: string };

export async function reemplazarTecnicosDeOrganizacion(tecnicos: TecnicoDeOrganizacion[]): Promise<void> {
  await enTransaccion(async (tx) => {
    await tx.delete(tecnicosDeOrganizacion);
    if (tecnicos.length > 0) await tx.insert(tecnicosDeOrganizacion).values(tecnicos);
  });
}

export async function getTecnicosDeOrganizacion(organizacionId: string): Promise<{ id: string; nombre: string }[]> {
  return db
    .select({ id: tecnicosDeOrganizacion.id, nombre: tecnicosDeOrganizacion.nombre })
    .from(tecnicosDeOrganizacion)
    .where(eq(tecnicosDeOrganizacion.organizacionId, organizacionId));
}

/** Un técnico que ya no está en el caché (dado de baja) no tiene nombre para mostrar. */
export const TECNICO_SIN_NOMBRE = 'Técnico sin nombre';

export async function getNombresDeTecnicos(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const filas = await db.select({ id: tecnicosDeOrganizacion.id, nombre: tecnicosDeOrganizacion.nombre })
    .from(tecnicosDeOrganizacion)
    .where(inArray(tecnicosDeOrganizacion.id, userIds));
  const porId = new Map(filas.map((f) => [f.id, f.nombre]));
  return userIds.map((id) => porId.get(id) ?? TECNICO_SIN_NOMBRE).sort((a, b) => a.localeCompare(b));
}
