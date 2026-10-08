import { db } from '../database/client';
import { enTransaccion } from '../database/transaccion';
import { trees, species as speciesTable, groups } from '../database/schema';
import { eq, max, and, isNotNull } from 'drizzle-orm';
import { generateSubId } from '../utils/idGenerator';
import { computeReversedPositions } from '../utils/reverseOrder';
import { notifyDataChanged } from '../database/liveQuery';
import * as Crypto from 'expo-crypto';
import { localNow } from '../utils/dateUtils';
import { markGroupPendingSync, getGroupParcelaCodigo } from './GroupRepository';
import { gruposQueSube, type Subidor } from './subidor';
import { descartarFotoQuitada, plantacionDelGrupo, registrarBorrado } from './BorradosRepository';
import { ENTIDAD_BORRADA } from '../constants/entidadBorrada';
import { isLocalUri, sqlIsLocalUri } from '../utils/photoUri';
import { codigoParaSubId, especieCodigoParaSubId, esEspecieRecuperada } from '../utils/speciesHelpers';
import { arbolesParaSubId } from './subIdsDeArboles';
import { borrarFotosLocales } from '../services/PhotoService';
import { puedeEditarArbolesDe, SIN_PERMISO_SOBRE_ARBOLES } from './edicionDeArboles';
import { archivosDeConflictosDeArbol, quitarConflictosDeArbol } from './ConflictosDeSyncRepository';

export interface InsertTreeParams {
  grupoId: string;
  grupoCodigo: string;
  especieId: string | null;  // null for N/N
  especieCodigo: string;     // 'NN' for N/N
  fotoUrl?: string | null;
  userId: string;
}

export interface InsertTreeResult {
  id: string;
  posicion: number;
  subId: string;
}

export async function insertTree(params: InsertTreeParams): Promise<InsertTreeResult> {
  // Siempre consulta MAX desde la DB, nunca confiar en React state.
  const [maxResult] = await db
    .select({ maxPos: max(trees.posicion) })
    .from(trees)
    .where(eq(trees.groupId, params.grupoId));

  const nextPosition = (maxResult?.maxPos ?? 0) + 1;
  const parcelaCodigo = await getGroupParcelaCodigo(params.grupoId);
  const subId = generateSubId(parcelaCodigo, params.grupoCodigo, codigoParaSubId(params.especieCodigo), nextPosition);

  const id = Crypto.randomUUID();
  await db.insert(trees).values({
    id,
    groupId: params.grupoId,
    especieId: params.especieId,
    especieBaseId: params.especieId,
    posicion: nextPosition,
    subId,
    fotoUrl: params.fotoUrl ?? null,
    usuarioRegistro: params.userId,
    createdAt: localNow(),
  });

  await markGroupPendingSync(params.grupoId);
  notifyDataChanged();
  return { id, posicion: nextPosition, subId };
}

/**
 * Deshacer el último árbol. Anota el borrado igual que `deleteTreeAndRecalculate`
 * (#467): sin eso el pull lo resucita, y este es el camino de borrado más usado.
 * No hace falta renumerar — se va el último.
 */
export async function deleteLastTree(grupoId: string): Promise<{ deleted: boolean }> {
  const [maxResult] = await db
    .select({ maxPos: max(trees.posicion), id: trees.id, fotoUrl: trees.fotoUrl })
    .from(trees)
    .where(eq(trees.groupId, grupoId));

  if (maxResult?.id == null) return { deleted: false };

  const plantacionId = await plantacionDelGrupo(db, grupoId);
  if (!plantacionId) {
    throw new Error(`Grupo ${grupoId} inexistente: no se puede borrar su árbol.`);
  }

  const archivosDeConflictos = await archivosDeConflictosDeArbol(maxResult.id);
  await enTransaccion(async (tx) => {
    await tx.delete(trees).where(eq(trees.id, maxResult.id));
    await registrarBorrado(tx, {
      id: maxResult.id, tipo: ENTIDAD_BORRADA.arbol, grupoId, plantacionId,
    });
    await quitarConflictosDeArbol(tx, maxResult.id);
  });
  borrarFotosDelArbol(maxResult.fotoUrl, archivosDeConflictos);

  await markGroupPendingSync(grupoId);
  notifyDataChanged();
  return { deleted: true };
}

export async function reverseTreeOrder(
  grupoId: string,
  grupoCodigo: string
): Promise<void> {
  const allTrees = await arbolesParaSubId(db, grupoId);
  if (allTrees.length === 0) return;

  const porId = new Map(allTrees.map((t) => [t.id, t]));
  const reversed = computeReversedPositions(allTrees);
  const parcelaCodigo = await getGroupParcelaCodigo(grupoId);

  await enTransaccion(async (tx) => {
    for (const { id, newPosicion } of reversed) {
      const especieCodigo = especieCodigoParaSubId(porId.get(id)!, [`${parcelaCodigo}${grupoCodigo}`]);
      const newSubId = generateSubId(parcelaCodigo, grupoCodigo, especieCodigo, newPosicion);
      await tx.update(trees)
        .set({ posicion: newPosicion, subId: newSubId })
        .where(eq(trees.id, id));
    }
  });
  await markGroupPendingSync(grupoId);
  notifyDataChanged();
}

/**
 * El árbol listo para pasar a `especieId`, con su SubID nuevo; null si falta el
 * árbol o la especie, o si es una recuperada: sin su código real no hay SubID.
 */
export async function destinoDelCambio(treeId: string, especieId: string) {
  const [sp] = await db.select({ codigo: speciesTable.codigo })
    .from(speciesTable)
    .where(eq(speciesTable.id, especieId));
  const [tree] = await db.select({ posicion: trees.posicion, grupoId: trees.groupId, grupoCodigo: groups.codigo })
    .from(trees)
    .innerJoin(groups, eq(groups.id, trees.groupId))
    .where(eq(trees.id, treeId));
  if (!sp || !tree || esEspecieRecuperada(sp.codigo)) return null;

  const parcelaCodigo = await getGroupParcelaCodigo(tree.grupoId);
  const subId = generateSubId(parcelaCodigo, tree.grupoCodigo, sp.codigo, tree.posicion);
  return { grupoId: tree.grupoId, subId };
}

/**
 * Cambia la especie de un árbol y rearma su SubID (#679). También resuelve un N/N.
 * No toca la base: el push la manda para que el server no pise un cambio que este
 * dispositivo no vio. Devuelve el SubID nuevo, o null si el árbol o la especie no
 * están.
 */
export async function cambiarEspecie(treeId: string, especieId: string): Promise<{ subId: string } | null> {
  const destino = await destinoDelCambio(treeId, especieId);
  if (!destino) return null;
  // Con la marca del grupo en la misma transacción: sin ella, el cambio no sube nunca.
  await enTransaccion(async (tx) => {
    await tx.update(trees).set({ especieId, subId: destino.subId }).where(eq(trees.id, treeId));
    await markGroupPendingSync(destino.grupoId);
  });
  notifyDataChanged();
  return { subId: destino.subId };
}

export interface TreeGpsPoint {
  latitude: number;
  longitude: number;
  gpsAccuracy: number | null;
  /** Momento del tap de registro (ISO local), no el momento en que resolvió el fix. */
  gpsCapturedAt: string;
}

/** Adjunta/reemplaza el punto GPS de un árbol; llega async después del alta (el fix puede resolver tarde). Re-marca el grupo pendiente para que el push lo suba si ya se había sincronizado. */
export async function updateTreeGps(treeId: string, point: TreeGpsPoint): Promise<void> {
  const [treeRow] = await db.select({ grupoId: trees.groupId }).from(trees).where(eq(trees.id, treeId));
  if (!treeRow) return; // árbol deshecho antes de que llegara el fix
  await db.update(trees).set(point).where(eq(trees.id, treeId));
  await markGroupPendingSync(treeRow.grupoId);
  notifyDataChanged();
}

/**
 * Borra el archivo de una foto que ya ninguna fila referencia (#490). Va después
 * de que la transacción cierre bien: con rollback la fila seguiría apuntándolo.
 */
function borrarFotoLocal(fotoUrl: string | null | undefined): void {
  if (fotoUrl) borrarFotosLocales([fotoUrl]);
}

/** La foto de un árbol borrado y las de sus conflictos (#795). */
function borrarFotosDelArbol(fotoUrl: string | null | undefined, deConflictos: string[]): void {
  borrarFotoLocal(fotoUrl);
  if (deConflictos.length > 0) borrarFotosLocales(deConflictos);
}

/**
 * Adjunta/reemplaza/borra la foto de un árbol (string vacío = borrar); resetea
 * fotoSynced=false para forzar re-upload a Storage.
 *
 * Quitarla se anota para propagarlo (#498): el push del grupo no puede poner la
 * foto en null en el server, y el pull la restauraría. Va en la misma transacción
 * que el update, por lo mismo que los borrados de fila.
 */
export async function updateTreePhoto(treeId: string, fotoUrl: string): Promise<void> {
  const nueva = fotoUrl || null;
  const [treeRow] = await db.select({ grupoId: trees.groupId, fotoUrl: trees.fotoUrl })
    .from(trees).where(eq(trees.id, treeId));
  if (!treeRow) return;
  if (!(await puedeEditarArbolesDe(treeRow.grupoId))) throw new Error(SIN_PERMISO_SOBRE_ARBOLES);
  const plantacionId = await plantacionDelGrupo(db, treeRow.grupoId);

  await enTransaccion(async (tx) => {
    await tx.update(trees)
      .set({ fotoUrl: nueva, fotoSynced: false })
      .where(eq(trees.id, treeId));
    if (fotoUrl) {
      await descartarFotoQuitada(tx, treeId);
    } else if (plantacionId) {
      await registrarBorrado(tx, { id: treeId, tipo: ENTIDAD_BORRADA.foto, grupoId: treeRow.grupoId, plantacionId });
    }
  });
  // Mismo path: el archivo "anterior" es el que queda en la fila.
  if (treeRow.fotoUrl !== nueva) borrarFotoLocal(treeRow.fotoUrl);
  await markGroupPendingSync(treeRow.grupoId);
  notifyDataChanged();
}

export interface ArbolConFotoPendiente {
  id: string;
  fotoUrl: string;
  /** El path que el teléfono vio en el server (#795). */
  fotoBase: string | null;
  grupoId: string;
  plantacionId: string;
  parcelaId: string | null;
}

/**
 * Árboles con fotos locales sin subir a Storage en la plantación, de los grupos que sube
 * `subidor` (sincronizados o no); filtra a file:// (rutas remotas del pull no se re-suben).
 */
export async function getTreesWithPendingPhotos(plantacionId: string, subidor: Subidor): Promise<ArbolConFotoPendiente[]> {
  const rows = await db
    .select({
      id: trees.id,
      fotoUrl: trees.fotoUrl,
      fotoBase: trees.fotoBase,
      grupoId: trees.groupId,
      plantacionId: groups.plantacionId,
      parcelaId: groups.parcelaId,
    })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(
      and(
        eq(groups.plantacionId, plantacionId),
        // Sin filtro por pendingSync del grupo: el upload de fotos debe funcionar sin importar el estado de sync, incluso con árboles de RPCs fallidos.
        isNotNull(trees.fotoUrl),
        eq(trees.fotoSynced, false),
        gruposQueSube(subidor),
      )
    );
  return rows.filter(r => isLocalUri(r.fotoUrl)) as ArbolConFotoPendiente[];
}

/** URIs de fotos guardadas en el device para los árboles de la plantación, sincronizadas o no. */
export async function getLocalPhotoUrisForPlantation(plantacionId: string): Promise<string[]> {
  const rows = await db
    .select({ fotoUrl: trees.fotoUrl })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(and(eq(groups.plantacionId, plantacionId), sqlIsLocalUri(trees.fotoUrl)));
  return rows.map((r) => r.fotoUrl).filter(isLocalUri);
}

/**
 * Borra un árbol y recalcula posición+subId de los restantes en el grupo para que
 * queden consecutivos (1,2,3...).
 *
 * El borrado, su registro para propagarlo al server y la renumeración van en UNA
 * transacción (#467): si el registro quedara afuera, un corte entre el delete y el
 * insert deja el borrado sin propagar y el próximo pull resucita el árbol con su
 * numeración vieja, duplicando SubIDs.
 */
export async function deleteTreeAndRecalculate(
  treeId: string,
  grupoId: string,
  grupoCodigo: string
): Promise<void> {
  const plantacionId = await plantacionDelGrupo(db, grupoId);
  if (!plantacionId) {
    throw new Error(`Grupo ${grupoId} inexistente: no se puede borrar su árbol.`);
  }
  const parcelaCodigo = await getGroupParcelaCodigo(grupoId);
  const [arbol] = await db.select({ fotoUrl: trees.fotoUrl }).from(trees).where(eq(trees.id, treeId));
  const archivosDeConflictos = await archivosDeConflictosDeArbol(treeId);

  await enTransaccion(async (tx) => {
    await tx.delete(trees).where(eq(trees.id, treeId));
    await registrarBorrado(tx, {
      id: treeId, tipo: ENTIDAD_BORRADA.arbol, grupoId, plantacionId,
    });

    const remaining = await arbolesParaSubId(tx, grupoId);

    for (let i = 0; i < remaining.length; i++) {
      const tree = remaining[i];
      const newPos = i + 1;
      const especieCodigo = especieCodigoParaSubId(tree, [`${parcelaCodigo}${grupoCodigo}`]);
      const newSubId = generateSubId(parcelaCodigo, grupoCodigo, especieCodigo, newPos);
      await tx.update(trees)
        .set({ posicion: newPos, subId: newSubId })
        .where(eq(trees.id, tree.id));
    }
    await quitarConflictosDeArbol(tx, treeId);
  });
  borrarFotosDelArbol(arbol?.fotoUrl, archivosDeConflictos);

  await markGroupPendingSync(grupoId);
  notifyDataChanged();
}
