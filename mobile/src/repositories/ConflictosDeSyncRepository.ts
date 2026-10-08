/**
 * Conflictos de sincronización (#795): datos que cambiaron en el teléfono y en el
 * servidor. El árbol o el grupo ya tienen el valor del servidor; acá queda el del
 * teléfono hasta que la persona elige.
 *
 * En un conflicto de foto, `mio` es el archivo local que el teléfono no subió.
 * Quien quita el conflicto se lleva la lista de archivos que ningún árbol usa,
 * para borrarlos después del commit.
 */
import { db } from '../database/client';
import { conflictosDeSync, trees } from '../database/schema';
import { and, asc, count, eq, inArray, type SQL } from 'drizzle-orm';
import { CAMPO_EN_CONFLICTO, type CampoEnConflicto } from '../constants/conflictoDeSync';
import { isLocalUri } from '../utils/photoUri';
import { localNow } from '../utils/dateUtils';

type Tx = typeof db;

export type ConflictoDeSync = typeof conflictosDeSync.$inferSelect;
export type ConflictoNuevo = Omit<ConflictoDeSync, 'detectadoEn'>;

/** El archivo local de un conflicto de foto. */
const archivoPropio = (c: Pick<ConflictoDeSync, 'campo' | 'mio'>): string[] =>
  c.campo === CAMPO_EN_CONFLICTO.foto && typeof c.mio === 'string' && isLocalUri(c.mio) ? [c.mio] : [];

/** Los que ningún árbol usa. Tras "conservar la mía" la foto propia es la del árbol. */
async function sinUsoEnArboles(tx: Tx, archivos: string[]): Promise<string[]> {
  if (archivos.length === 0) return [];
  const enUso = await tx.select({ fotoUrl: trees.fotoUrl }).from(trees).where(inArray(trees.fotoUrl, archivos));
  const usados = new Set(enUso.map((f) => f.fotoUrl));
  return archivos.filter((archivo) => !usados.has(archivo));
}

const delCampo = (entidadId: string, campo: CampoEnConflicto) =>
  and(eq(conflictosDeSync.entidadId, entidadId), eq(conflictosDeSync.campo, campo));

/** Guarda o reemplaza el conflicto. Devuelve el archivo del conflicto reemplazado, si deja de usarse. */
export async function guardarConflicto(tx: Tx, conflicto: ConflictoNuevo): Promise<string[]> {
  const [anterior] = await tx.select().from(conflictosDeSync).where(delCampo(conflicto.entidadId, conflicto.campo));
  const fila = { ...conflicto, detectadoEn: localNow() };
  await tx.insert(conflictosDeSync).values(fila).onConflictDoUpdate({
    target: [conflictosDeSync.entidadId, conflictosDeSync.campo],
    set: { mio: fila.mio, servidor: fila.servidor, detectadoEn: fila.detectadoEn },
  });
  if (!anterior) return [];
  return sinUsoEnArboles(tx, archivoPropio(anterior).filter((archivo) => archivo !== conflicto.mio));
}

/** Quita los conflictos de esos campos. Devuelve los archivos que dejan de usarse. */
export async function quitarConflictos(tx: Tx, entidadId: string, campos: CampoEnConflicto[]): Promise<string[]> {
  if (campos.length === 0) return [];
  const quitados = await tx.delete(conflictosDeSync)
    .where(and(eq(conflictosDeSync.entidadId, entidadId), inArray(conflictosDeSync.campo, campos)))
    .returning();
  return sinUsoEnArboles(tx, quitados.flatMap(archivoPropio));
}

// Al borrar un árbol, un grupo o una plantación sus conflictos se van con ellos.
// Los archivos se leen antes de la transacción, como las fotos de las filas.
const deArbol = (treeId: string) => eq(conflictosDeSync.entidadId, treeId);
const deGrupo = (grupoId: string) => eq(conflictosDeSync.grupoId, grupoId);
const dePlantacion = (plantacionId: string) => eq(conflictosDeSync.plantacionId, plantacionId);

async function archivosDonde(donde: SQL): Promise<string[]> {
  const filas = await db.select({ campo: conflictosDeSync.campo, mio: conflictosDeSync.mio })
    .from(conflictosDeSync).where(donde);
  return filas.flatMap(archivoPropio);
}

export const archivosDeConflictosDeArbol = (treeId: string) => archivosDonde(deArbol(treeId));
export const archivosDeConflictosDeGrupo = (grupoId: string) => archivosDonde(deGrupo(grupoId));
export const archivosDeConflictosDePlantacion = (plantacionId: string) => archivosDonde(dePlantacion(plantacionId));

export const quitarConflictosDeArbol = (tx: Tx, treeId: string) => tx.delete(conflictosDeSync).where(deArbol(treeId));
export const quitarConflictosDeGrupo = (tx: Tx, grupoId: string) => tx.delete(conflictosDeSync).where(deGrupo(grupoId));
export const quitarConflictosDePlantacion = (tx: Tx, plantacionId: string) =>
  tx.delete(conflictosDeSync).where(dePlantacion(plantacionId));

export async function conflictoDe(entidadId: string, campo: CampoEnConflicto): Promise<ConflictoDeSync | undefined> {
  const [conflicto] = await db.select().from(conflictosDeSync).where(delCampo(entidadId, campo));
  return conflicto;
}

export async function hayConflictosEnGrupo(grupoId: string): Promise<boolean> {
  const [fila] = await db.select({ n: count() }).from(conflictosDeSync).where(eq(conflictosDeSync.grupoId, grupoId));
  return (fila?.n ?? 0) > 0;
}

export function conflictosDePlantacion(plantacionId: string): Promise<ConflictoDeSync[]> {
  return db.select().from(conflictosDeSync)
    .where(eq(conflictosDeSync.plantacionId, plantacionId))
    .orderBy(asc(conflictosDeSync.grupoId), asc(conflictosDeSync.entidadId));
}
