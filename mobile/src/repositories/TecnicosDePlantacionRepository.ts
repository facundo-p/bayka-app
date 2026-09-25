/**
 * Técnicos de una plantación (#636). Asignar se aplica en `plantation_users` en el
 * momento y queda anotado hasta que el server lo acepta; quitar es solo online, así
 * que se refleja acá recién cuando el server respondió.
 */
import { db } from '../database/client';
import { enTransaccion } from '../database/transaccion';
import { altasDeTecnicosPendientes, plantationUsers, plantations, tecnicosDeOrganizacion } from '../database/schema';
import { and, count, eq, inArray } from 'drizzle-orm';
import { ROL } from '../constants/roles';
import { localNow } from '../utils/dateUtils';
import { TECNICO_SIN_NOMBRE } from '../utils/tecnicosDePlantacion';
import { plantacionSubida } from './plantacionSubida';

/** Ejecutor drizzle: el cliente `db` o una transacción `tx`. */
type DbExecutor = Pick<typeof db, 'insert' | 'delete' | 'select' | 'update'>;

async function nombresDelCache(exec: DbExecutor, userIds: string[]): Promise<Map<string, string>> {
  const filas = await exec.select({ id: tecnicosDeOrganizacion.id, nombre: tecnicosDeOrganizacion.nombre })
    .from(tecnicosDeOrganizacion)
    .where(inArray(tecnicosDeOrganizacion.id, userIds));
  return new Map(filas.map((f) => [f.id, f.nombre]));
}

/** Asigna en el teléfono y lo anota para subir, con el nombre que tiene hoy en el caché. */
export async function guardarAltasDeTecnicos(plantacionId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const asignadoEn = localNow();
  await enTransaccion(async (tx) => {
    const nombres = await nombresDelCache(tx, userIds);
    await tx.insert(plantationUsers)
      .values(userIds.map((userId) => ({ plantationId: plantacionId, userId, rolEnPlantacion: ROL.tecnico, assignedAt: asignadoEn })))
      .onConflictDoNothing();
    await tx.insert(altasDeTecnicosPendientes)
      .values(userIds.map((userId) => ({ plantacionId, userId, nombre: nombres.get(userId) ?? '', asignadoEn })))
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

export async function getAltasPendientesConNombre(plantacionId: string): Promise<{ id: string; nombre: string }[]> {
  return db
    .select({ id: altasDeTecnicosPendientes.userId, nombre: altasDeTecnicosPendientes.nombre })
    .from(altasDeTecnicosPendientes)
    .where(eq(altasDeTecnicosPendientes.plantacionId, plantacionId));
}

export async function getAltasPendientes(plantacionId: string): Promise<string[]> {
  return (await getAltasPendientesConNombre(plantacionId)).map((a) => a.id);
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

/**
 * Nombres para avisar: del caché o, si ya salió (dado de baja), el que se guardó al
 * asignarlo. Hay que pedirlos antes de registrar la respuesta, que borra la cola.
 */
export async function getNombresDeTecnicos(plantacionId: string, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const delCache = await nombresDelCache(db, userIds);
  const deLaCola = new Map((await getAltasPendientesConNombre(plantacionId)).map((a) => [a.id, a.nombre]));
  return userIds
    .map((id) => delCache.get(id) || deLaCola.get(id) || TECNICO_SIN_NOMBRE)
    .sort((a, b) => a.localeCompare(b));
}
