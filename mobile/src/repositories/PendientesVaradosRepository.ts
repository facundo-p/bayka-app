/**
 * Pendientes varados (#638): lo que el teléfono no puede subir porque la plantación
 * dejó de ser escribible o el usuario perdió el permiso. El motivo lo guarda el sync;
 * descartar saca lo pendiente y deja que el próximo pull traiga lo del server.
 */
import { db } from '../database/client';
import { enTransaccion } from '../database/transaccion';
import { notifyDataChanged } from '../database/liveQuery';
import { borradosPendientes, groups, parcelas, plantations, trees } from '../database/schema';
import { and, eq, inArray, notInArray, or } from 'drizzle-orm';
import type { MotivoVarado } from '../constants/motivoVarado';
import { conservaLoQueSube, descartarLaSaca } from '../utils/avisoPendientesVarados';
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

const gruposPendientes = (plantacionId: string) =>
  db.select({ id: groups.id }).from(groups)
    .where(and(eq(groups.plantacionId, plantacionId), eq(groups.pendingSync, true)));

const gruposDeLaPlantacion = (plantacionId: string) =>
  db.select({ id: groups.id }).from(groups).where(eq(groups.plantacionId, plantacionId));

const parcelasConGrupos = () => db.select({ id: groups.parcelaId }).from(groups);

const parcelaPendiente = (plantacionId: string) =>
  and(eq(parcelas.plantacionId, plantacionId), eq(parcelas.pendingSync, true));

const fotoSinSubir = and(sqlIsLocalUri(trees.fotoUrl), eq(trees.fotoSynced, false));

/** Archivos que quedan sin fila: los de los árboles que se borran y, si se descartan, las fotos sin subir. */
async function fotosADescartar(plantacionId: string, conservaFotos: boolean): Promise<string[]> {
  const deGruposPendientes = and(inArray(trees.groupId, gruposPendientes(plantacionId)), sqlIsLocalUri(trees.fotoUrl));
  const sinSubir = and(inArray(trees.groupId, gruposDeLaPlantacion(plantacionId)), fotoSinSubir);
  const filas = await db.select({ fotoUrl: trees.fotoUrl }).from(trees)
    .where(conservaFotos ? deGruposPendientes : or(deGruposPendientes, sinSubir));
  return filas.map((f) => f.fotoUrl).filter(isLocalUri);
}

type FilaDePlantacion = typeof plantations.$inferSelect;

/**
 * Grupos y parcelas pendientes, borrados y fotos. Un grupo pendiente se borra aunque ya
 * exista en el server (volvió a pendiente por un cambio): el pull lo trae de vuelta cuando
 * corre, y sin permiso recién al recuperar el acceso. Los grupos sin cambios se quedan. Una
 * parcela pendiente con grupos ya subidos existe en el server (sus grupos no suben antes que
 * ella): deja de estar pendiente y el pull la pisa.
 */
async function descartarFilasDeCampo(tx: typeof db, plantacionId: string, conservaFotos: boolean): Promise<void> {
  if (!conservaFotos) {
    await tx.update(trees).set({ fotoUrl: null, fotoSynced: false })
      .where(and(inArray(trees.groupId, gruposDeLaPlantacion(plantacionId)), fotoSinSubir));
  }
  await tx.delete(trees).where(inArray(trees.groupId, gruposPendientes(plantacionId)));
  await tx.delete(groups).where(inArray(groups.id, gruposPendientes(plantacionId)));
  await tx.delete(parcelas).where(and(parcelaPendiente(plantacionId), notInArray(parcelas.id, parcelasConGrupos())));
  await tx.update(parcelas).set({ pendingSync: false }).where(parcelaPendiente(plantacionId));
  await tx.delete(borradosPendientes).where(eq(borradosPendientes.plantacionId, plantacionId));
}

async function descartarDePlantacionExistente(fila: FilaDePlantacion): Promise<void> {
  const conserva = conservaLoQueSube(fila.motivoVarado);
  const especies = comoAltasYBajas(await getCambiosPendientes(fila.id));
  const tecnicos = conserva ? [] : await getAltasPendientes(fila.id);
  const fotos = await fotosADescartar(fila.id, conserva);
  await enTransaccion(async (tx) => {
    await tx.update(plantations)
      .set({ ...(fila.pendingEdit ? sinEdicionPendiente(fila) : {}), motivoVarado: null })
      .where(eq(plantations.id, fila.id));
    await deshacerGuardado(fila.id, especies, []);
    await quitarTecnicosLocal(fila.id, tecnicos);
    await descartarFilasDeCampo(tx, fila.id, conserva);
  });
  // Recién después del commit: con rollback las filas seguirían apuntando a los archivos.
  borrarFotosLocales(fotos);
  notifyDataChanged();
}

/**
 * Descarta lo que no pudo subir. Un alta que nunca terminó de subir, o una plantación
 * eliminada en el servidor, se va del dispositivo entera. Si no, la plantación se queda
 * sin sus pendientes y el próximo pull, si corre, la deja como está en el servidor.
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
