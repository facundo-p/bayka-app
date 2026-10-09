/**
 * Escrituras después de un push confirmado (#795): la base pasa a ser lo que tiene
 * el servidor, y lo que el servidor conservó se adopta.
 *
 * Toda adopción va con la guarda "la fila sigue con lo que se mandó": si cambió
 * durante el push no se pisa, no se toca la base, y devuelve false para que el
 * grupo siga pendiente y el próximo push lo vuelva a resolver.
 */
import { db } from '../database/client';
import { groups, trees } from '../database/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { isRemoteUri } from '../utils/photoUri';
import { getGroupParcelaCodigo } from './GroupRepository';
import { destinoDelCambio } from './TreeRepository';
import { recalcularSubIdsDelGrupo } from './subIdsDeArboles';
import { descartarFotoQuitada } from './BorradosRepository';
import { isUniqueConstraintError } from '../database/sqliteErrors';
import {
  CAMPO_EN_CONFLICTO, type CampoDeGrupo, type DatosDeGrupo, type PuntoGps,
} from '../constants/conflictoDeSync';

type Tx = typeof db;

const es = (columna: SQLiteColumn, valor: unknown) => sql`${columna} IS ${valor}`;

const mismoPuntoQue = (p: PuntoGps) => and(
  es(trees.latitude, p.latitude), es(trees.longitude, p.longitude), es(trees.gpsCapturedAt, p.gpsCapturedAt),
);

const basesDelPunto = (p: PuntoGps) => ({
  latitudeBase: p.latitude, longitudeBase: p.longitude, gpsCapturedAtBase: p.gpsCapturedAt,
});

export const confirmarBaseDeEspecie = (tx: Tx, treeId: string, especieId: string | null) =>
  tx.update(trees).set({ especieBaseId: especieId }).where(eq(trees.id, treeId));

export const confirmarBaseDeGps = (tx: Tx, treeId: string, punto: PuntoGps) =>
  tx.update(trees).set(basesDelPunto(punto)).where(eq(trees.id, treeId));

/**
 * La foto que subió el push: es la base, y la local queda subida si la fila sigue
 * con ella. Recién ahí reemplaza a una foto quitada sin propagar (#816).
 */
export async function confirmarFotoSubida(tx: Tx, treeId: string, uriLocal: string, path: string): Promise<void> {
  await tx.update(trees).set({ fotoBase: path }).where(eq(trees.id, treeId));
  const subida = await tx.update(trees).set({ fotoSynced: true })
    .where(and(eq(trees.id, treeId), eq(trees.fotoUrl, uriLocal)))
    .returning({ id: trees.id });
  if (subida.length > 0) await descartarFotoQuitada(tx, treeId);
}

/** Fotos que el servidor quitó: ya no tiene ninguna, y esa es la base. */
export async function confirmarFotosQuitadas(tx: Tx, treeIds: string[]): Promise<void> {
  if (treeIds.length === 0) return;
  await tx.update(trees).set({ fotoBase: null }).where(inArray(trees.id, treeIds));
}

export const confirmarBaseDeFoto = (tx: Tx, treeId: string, path: string) =>
  tx.update(trees).set({ fotoBase: path }).where(eq(trees.id, treeId));

/** Sin la especie en el catálogo local no se adopta: el próximo push la vuelve a recibir. */
export async function adoptarEspecie(tx: Tx, treeId: string, enviada: string | null, delServidor: string | null): Promise<boolean> {
  if (delServidor == null) return false;
  const destino = await destinoDelCambio(treeId, delServidor);
  if (!destino) return false;
  const escritos = await tx.update(trees)
    .set({ especieId: delServidor, especieBaseId: delServidor, subId: destino.subId })
    .where(and(eq(trees.id, treeId), es(trees.especieId, enviada)))
    .returning({ id: trees.id });
  return escritos.length > 0;
}

export async function adoptarGps(tx: Tx, treeId: string, enviado: PuntoGps, delServidor: PuntoGps): Promise<boolean> {
  const escritos = await tx.update(trees)
    .set({
      latitude: delServidor.latitude, longitude: delServidor.longitude,
      gpsAccuracy: delServidor.gpsAccuracy, gpsCapturedAt: delServidor.gpsCapturedAt,
      ...basesDelPunto(delServidor),
    })
    .where(and(eq(trees.id, treeId), mismoPuntoQue(enviado)))
    .returning({ id: trees.id });
  return escritos.length > 0;
}

/** El path del servidor queda como foto; la descarga de fotos la baja después. */
export async function adoptarFoto(tx: Tx, treeId: string, local: string | null, delServidor: string | null): Promise<boolean> {
  const escritos = await tx.update(trees)
    .set({ fotoUrl: delServidor, fotoSynced: isRemoteUri(delServidor), fotoBase: delServidor })
    .where(and(eq(trees.id, treeId), es(trees.fotoUrl, local)))
    .returning({ id: trees.id });
  return escritos.length > 0;
}

async function escribirCampoDeGrupo(tx: Tx, grupoId: string, campo: CampoDeGrupo, enviado: string, delServidor: string) {
  try {
    return await tx.update(groups)
      .set({ [campo]: delServidor } as Partial<typeof groups.$inferInsert>)
      .where(and(eq(groups.id, grupoId), eq(groups[campo], enviado)))
      .returning({ id: groups.id });
  } catch (e) {
    // Otro grupo local de la parcela ya usa ese nombre o código.
    if (isUniqueConstraintError(e)) return [];
    throw e;
  }
}

/** Sin marcar el grupo pendiente: el valor viene del servidor. */
export async function adoptarCampoDeGrupo(
  tx: Tx,
  grupoId: string,
  campo: CampoDeGrupo,
  enviado: string,
  delServidor: string,
): Promise<boolean> {
  const escritos = await escribirCampoDeGrupo(tx, grupoId, campo, enviado, delServidor);
  if (escritos.length === 0) return false;
  if (campo === CAMPO_EN_CONFLICTO.codigo) await rearmarSubIds(tx, grupoId, enviado, delServidor);
  return true;
}

async function rearmarSubIds(tx: Tx, grupoId: string, anterior: string, nuevo: string): Promise<void> {
  const parcelaCodigo = await getGroupParcelaCodigo(grupoId);
  await recalcularSubIdsDelGrupo(tx, grupoId, { parcelaCodigo, grupoCodigo: anterior }, { parcelaCodigo, grupoCodigo: nuevo });
}

export const confirmarBaseDelGrupo = (tx: Tx, grupoId: string, base: DatosDeGrupo) =>
  tx.update(groups).set({ baseDelServidor: base }).where(eq(groups.id, grupoId));
