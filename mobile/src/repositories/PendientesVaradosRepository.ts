/**
 * Pendientes varados (#638): lo que el teléfono no puede subir porque la plantación
 * dejó de ser escribible o el usuario perdió el permiso. El motivo lo guarda el sync;
 * descartar saca lo pendiente y deja que el próximo pull traiga lo del server.
 */
import { db } from '../database/client';
import { enTransaccion } from '../database/transaccion';
import { notifyDataChanged } from '../database/liveQuery';
import { borradosPendientes, groups, parcelas, plantations, trees } from '../database/schema';
import { and, eq, inArray, or } from 'drizzle-orm';
import type { MotivoVarado } from '../constants/motivoVarado';
import { descartarLaSaca } from '../utils/avisoPendientesVarados';
import { sinEdicionPendiente } from '../utils/camposDePlantacion';
import { isLocalUri, sqlIsLocalUri } from '../utils/photoUri';
import { borrarFotosLocales } from '../services/PhotoService';
import { comoAltasYBajas, deshacerGuardado, getCambiosPendientes } from './CambiosDeEspeciesRepository';
import { getAltasPendientes, quitarTecnicosLocal } from './TecnicosDePlantacionRepository';
import { deletePlantationLocally } from './PlantationRepository';

export async function guardarMotivoVarado(plantacionId: string, motivo: MotivoVarado): Promise<void> {
  await db.update(plantations).set({ motivoVarado: motivo }).where(eq(plantations.id, plantacionId));
}

/** `motivos`: limpia solo si es uno de esos; sin él, cualquiera. */
export async function limpiarMotivoVarado(plantacionId: string, motivos?: readonly MotivoVarado[]): Promise<void> {
  const dePlantacion = eq(plantations.id, plantacionId);
  await db.update(plantations).set({ motivoVarado: null })
    .where(motivos ? and(dePlantacion, inArray(plantations.motivoVarado, [...motivos])) : dePlantacion);
}

// ─── Descartar ───────────────────────────────────────────────────────────────

const parcelasPendientes = (plantacionId: string) =>
  db.select({ id: parcelas.id }).from(parcelas)
    .where(and(eq(parcelas.plantacionId, plantacionId), eq(parcelas.pendingSync, true)));

/** Los grupos pendientes y los de una parcela pendiente, que se va con ellos (FK). */
const gruposADescartar = (plantacionId: string) =>
  db.select({ id: groups.id }).from(groups).where(and(
    eq(groups.plantacionId, plantacionId),
    or(eq(groups.pendingSync, true), inArray(groups.parcelaId, parcelasPendientes(plantacionId))),
  ));

const gruposDeLaPlantacion = (plantacionId: string) =>
  db.select({ id: groups.id }).from(groups).where(eq(groups.plantacionId, plantacionId));

const fotoSinSubir = and(sqlIsLocalUri(trees.fotoUrl), eq(trees.fotoSynced, false));

/** Archivos que quedan sin fila: los de los árboles que se borran y las fotos sin subir. */
async function fotosADescartar(plantacionId: string): Promise<string[]> {
  const filas = await db.select({ fotoUrl: trees.fotoUrl }).from(trees).where(or(
    and(inArray(trees.groupId, gruposADescartar(plantacionId)), sqlIsLocalUri(trees.fotoUrl)),
    and(inArray(trees.groupId, gruposDeLaPlantacion(plantacionId)), fotoSinSubir),
  ));
  return filas.map((f) => f.fotoUrl).filter(isLocalUri);
}

type FilaDePlantacion = typeof plantations.$inferSelect;

/** Grupos, parcelas, borrados y fotos: todo lo que el pull vuelve a traer del server. */
async function descartarFilasDeCampo(tx: typeof db, plantacionId: string): Promise<void> {
  await tx.update(trees).set({ fotoUrl: null, fotoSynced: false })
    .where(and(inArray(trees.groupId, gruposDeLaPlantacion(plantacionId)), fotoSinSubir));
  await tx.delete(trees).where(inArray(trees.groupId, gruposADescartar(plantacionId)));
  await tx.delete(groups).where(inArray(groups.id, gruposADescartar(plantacionId)));
  await tx.delete(parcelas).where(and(eq(parcelas.plantacionId, plantacionId), eq(parcelas.pendingSync, true)));
  await tx.delete(borradosPendientes).where(eq(borradosPendientes.plantacionId, plantacionId));
}

async function descartarDePlantacionExistente(fila: FilaDePlantacion): Promise<void> {
  const especies = comoAltasYBajas(await getCambiosPendientes(fila.id));
  const tecnicos = await getAltasPendientes(fila.id);
  const fotos = await fotosADescartar(fila.id);
  await enTransaccion(async (tx) => {
    await tx.update(plantations)
      .set({ ...(fila.pendingEdit ? sinEdicionPendiente(fila) : {}), motivoVarado: null })
      .where(eq(plantations.id, fila.id));
    await deshacerGuardado(fila.id, especies, []);
    await quitarTecnicosLocal(fila.id, tecnicos);
    await descartarFilasDeCampo(tx, fila.id);
  });
  // Recién después del commit: con rollback las filas seguirían apuntando a los archivos.
  borrarFotosLocales(fotos);
  notifyDataChanged();
}

/**
 * Descarta lo que no pudo subir. Un alta que nunca terminó de subir, o una plantación
 * eliminada en el servidor, se va del dispositivo entera. Si no, la plantación se queda
 * y el próximo pull la deja como está en el servidor.
 */
export async function descartarPendientes(plantacionId: string): Promise<void> {
  const [fila] = await db.select().from(plantations).where(eq(plantations.id, plantacionId));
  if (!fila) return;
  if (descartarLaSaca(fila)) {
    await deletePlantationLocally(plantacionId);
    return;
  }
  await descartarDePlantacionExistente(fila);
}
