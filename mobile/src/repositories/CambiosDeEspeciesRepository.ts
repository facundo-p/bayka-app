/**
 * Altas y bajas de especies de una plantación (#635). Se aplican en SQLite en el
 * momento y quedan anotadas hasta que el server las acepta. Por cambio y no por
 * lista: subir la lista entera pisaría lo que la web cambió en el medio.
 */
import { db } from '../database/client';
import { enTransaccion } from '../database/transaccion';
import { cambiosEspeciesPendientes, plantationSpecies, plantations, species } from '../database/schema';
import { and, count, eq, inArray } from 'drizzle-orm';
import { CAMBIO_DE_ESPECIE, type CambioDeEspecie } from '../constants/cambioDeEspecie';
import { plantationSpeciesId } from '../utils/plantationSpeciesId';
import { localNow } from '../utils/dateUtils';
import type { AltasYBajas } from '../utils/altasYBajas';
import { porNombre } from '../utils/ordenEspecies';
import { plantacionSubida } from './plantacionSubida';

/** Ejecutor drizzle: el cliente `db` o una transacción `tx`. */
type DbExecutor = Pick<typeof db, 'insert' | 'delete' | 'select' | 'update'>;

export type CambiosDeEspecies = AltasYBajas;
export type CambioPendiente = { especieId: string; tipo: CambioDeEspecie };

async function habilitarLocal(exec: DbExecutor, plantacionId: string, especieIds: string[]): Promise<void> {
  if (especieIds.length === 0) return;
  await exec.insert(plantationSpecies).values(especieIds.map((especieId) => ({
    id: plantationSpeciesId(plantacionId, especieId),
    plantacionId,
    especieId,
  }))).onConflictDoNothing();
}

async function deshabilitarLocal(exec: DbExecutor, plantacionId: string, especieIds: string[]): Promise<void> {
  if (especieIds.length === 0) return;
  await exec.delete(plantationSpecies).where(and(
    eq(plantationSpecies.plantacionId, plantacionId),
    inArray(plantationSpecies.especieId, especieIds),
  ));
}

async function anotar(exec: DbExecutor, plantacionId: string, especieIds: string[], tipo: CambioDeEspecie): Promise<void> {
  if (especieIds.length === 0) return;
  const cambiadoEn = localNow();
  await exec.insert(cambiosEspeciesPendientes)
    .values(especieIds.map((especieId) => ({ plantacionId, especieId, tipo, cambiadoEn })))
    .onConflictDoUpdate({
      target: [cambiosEspeciesPendientes.plantacionId, cambiosEspeciesPendientes.especieId],
      set: { tipo, cambiadoEn },
    });
}

async function olvidar(exec: DbExecutor, plantacionId: string, especieIds: string[]): Promise<void> {
  if (especieIds.length === 0) return;
  await exec.delete(cambiosEspeciesPendientes).where(and(
    eq(cambiosEspeciesPendientes.plantacionId, plantacionId),
    inArray(cambiosEspeciesPendientes.especieId, especieIds),
  ));
}

/**
 * Aplica en SQLite y lo anota para subir. Una plantación sin subir (pendingSync) anota
 * solo las bajas: su alta sube todas sus especies como altas, pero si un intento
 * anterior ya las subió, una baja posterior se perdería. Devuelve si estaba sin subir:
 * se lee acá y no de la pantalla, que pudo abrirse antes de que un sync la subiera.
 */
export async function guardarCambiosDeEspecies(
  plantacionId: string,
  { altas, bajas }: CambiosDeEspecies,
): Promise<boolean> {
  return enTransaccion(async (tx) => {
    const [fila] = await tx.select({ pendingSync: plantations.pendingSync }).from(plantations)
      .where(eq(plantations.id, plantacionId));
    const pendingSync = fila?.pendingSync ?? false;
    await habilitarLocal(tx, plantacionId, altas);
    await deshabilitarLocal(tx, plantacionId, bajas);
    if (pendingSync) await olvidar(tx, plantacionId, altas);
    else await anotar(tx, plantacionId, altas, CAMBIO_DE_ESPECIE.alta);
    await anotar(tx, plantacionId, bajas, CAMBIO_DE_ESPECIE.baja);
    return pendingSync;
  });
}

/**
 * Deshace un guardado que el server no admitió: SQLite y el registro vuelven a como
 * estaban antes de él. Lo pendiente de antes sigue pendiente.
 */
export async function deshacerGuardado(
  plantacionId: string,
  { altas, bajas }: CambiosDeEspecies,
  previos: CambioPendiente[],
): Promise<void> {
  const tocadas = [...altas, ...bajas];
  const aRestaurar = comoAltasYBajas(previos.filter((p) => tocadas.includes(p.especieId)));
  await enTransaccion(async (tx) => {
    await deshabilitarLocal(tx, plantacionId, altas);
    await habilitarLocal(tx, plantacionId, bajas);
    await olvidar(tx, plantacionId, tocadas);
    await anotar(tx, plantacionId, aRestaurar.altas, CAMBIO_DE_ESPECIE.alta);
    await anotar(tx, plantacionId, aRestaurar.bajas, CAMBIO_DE_ESPECIE.baja);
  });
}

export async function getCambiosPendientes(plantacionId: string): Promise<CambioPendiente[]> {
  const filas = await db
    .select({ especieId: cambiosEspeciesPendientes.especieId, tipo: cambiosEspeciesPendientes.tipo })
    .from(cambiosEspeciesPendientes)
    .where(eq(cambiosEspeciesPendientes.plantacionId, plantacionId));
  return filas as CambioPendiente[];
}

export function comoAltasYBajas(cambios: CambioPendiente[]): CambiosDeEspecies {
  const de = (tipo: CambioDeEspecie) => cambios.filter((c) => c.tipo === tipo).map((c) => c.especieId);
  return { altas: de(CAMBIO_DE_ESPECIE.alta), bajas: de(CAMBIO_DE_ESPECIE.baja) };
}

/** Plantaciones con cambios para subir: ni sin subir (su alta los lleva) ni eliminadas en el server. */
export async function getPlantacionesConCambiosDeEspecies(): Promise<{ id: string; lugar: string }[]> {
  return db
    .selectDistinct({ id: plantations.id, lugar: plantations.lugar })
    .from(cambiosEspeciesPendientes)
    .innerJoin(plantations, eq(plantations.id, cambiosEspeciesPendientes.plantacionId))
    .where(plantacionSubida);
}

export async function countCambiosDeEspecies(plantacionId: string): Promise<number> {
  const [fila] = await db
    .select({ cnt: count() })
    .from(cambiosEspeciesPendientes)
    .where(eq(cambiosEspeciesPendientes.plantacionId, plantacionId));
  return fila?.cnt ?? 0;
}

/** Saca del registro lo enviado; un cambio de signo contrario anotado mientras tanto se conserva. */
async function descartar(exec: DbExecutor, plantacionId: string, enviados: CambioPendiente[]): Promise<void> {
  const { altas, bajas } = comoAltasYBajas(enviados);
  for (const [tipo, ids] of [[CAMBIO_DE_ESPECIE.alta, altas], [CAMBIO_DE_ESPECIE.baja, bajas]] as const) {
    if (ids.length === 0) continue;
    await exec.delete(cambiosEspeciesPendientes).where(and(
      eq(cambiosEspeciesPendientes.plantacionId, plantacionId),
      eq(cambiosEspeciesPendientes.tipo, tipo),
      inArray(cambiosEspeciesPendientes.especieId, ids),
    ));
  }
}

/**
 * Registra la respuesta del server: lo enviado deja de estar pendiente, y lo que
 * rechazó vuelve en SQLite a como está allá (una baja rechazada re-habilita la especie).
 */
export async function registrarRespuesta(
  plantacionId: string,
  enviados: CambioPendiente[],
  rechazados: CambioPendiente[],
): Promise<void> {
  const { altas, bajas } = comoAltasYBajas(rechazados);
  await enTransaccion(async (tx) => {
    await deshabilitarLocal(tx, plantacionId, altas);
    await habilitarLocal(tx, plantacionId, bajas);
    await descartar(tx, plantacionId, enviados);
  });
}

/** El catálogo re-apuntó una especie local a la del server: sus cambios pendientes la siguen. */
export async function reapuntarCambiosDeEspecie(exec: DbExecutor, desde: string, hacia: string): Promise<void> {
  const conHacia = exec.select({ id: cambiosEspeciesPendientes.plantacionId }).from(cambiosEspeciesPendientes)
    .where(eq(cambiosEspeciesPendientes.especieId, hacia));
  await exec.delete(cambiosEspeciesPendientes).where(and(
    eq(cambiosEspeciesPendientes.especieId, desde),
    inArray(cambiosEspeciesPendientes.plantacionId, conHacia),
  ));
  await exec.update(cambiosEspeciesPendientes).set({ especieId: hacia })
    .where(eq(cambiosEspeciesPendientes.especieId, desde));
}

export type EspecieConNombre = { especieId: string; nombre: string };

export async function getEspeciesPorId(especieIds: string[]): Promise<EspecieConNombre[]> {
  if (especieIds.length === 0) return [];
  const filas = await db.select({ especieId: species.id, nombre: species.nombre }).from(species)
    .where(inArray(species.id, especieIds));
  return porNombre(filas);
}
