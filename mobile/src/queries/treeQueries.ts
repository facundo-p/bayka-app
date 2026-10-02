import { desc, eq } from 'drizzle-orm';
import { db } from '../database/client';
import { groups, plantations, species, trees } from '../database/schema';

/**
 * Árboles de un grupo para la pantalla de registro (más recientes primero),
 * con especie resuelta y punto GPS (latitude null = árbol sin punto).
 */
export function getTreesForGroup(grupoId: string) {
  return db
    .select({
      id: trees.id,
      grupoId: trees.groupId,
      especieId: trees.especieId,
      posicion: trees.posicion,
      subId: trees.subId,
      fotoUrl: trees.fotoUrl,
      fotoSynced: trees.fotoSynced,
      usuarioRegistro: trees.usuarioRegistro,
      createdAt: trees.createdAt,
      latitude: trees.latitude,
      longitude: trees.longitude,
      gpsAccuracy: trees.gpsAccuracy,
      especieCodigo: species.codigo,
      especieNombre: species.nombre,
    })
    .from(trees)
    .leftJoin(species, eq(trees.especieId, species.id))
    .where(eq(trees.groupId, grupoId))
    .orderBy(desc(trees.posicion));
}

/**
 * Detalle de un árbol para la pantalla de edición: especie (nombre + nombre
 * científico), punto GPS completo y el código de su plantación, que forma el ID.
 */
export function getTreeDetail(treeId: string) {
  return db
    .select({
      id: trees.id,
      grupoId: trees.groupId,
      especieId: trees.especieId,
      posicion: trees.posicion,
      subId: trees.subId,
      fotoUrl: trees.fotoUrl,
      fotoSynced: trees.fotoSynced,
      createdAt: trees.createdAt,
      latitude: trees.latitude,
      longitude: trees.longitude,
      gpsAccuracy: trees.gpsAccuracy,
      gpsCapturedAt: trees.gpsCapturedAt,
      especieCodigo: species.codigo,
      especieNombre: species.nombre,
      especieNombreCientifico: species.nombreCientifico,
      plantacionCodigo: plantations.codigo,
    })
    .from(trees)
    .leftJoin(species, eq(trees.especieId, species.id))
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .innerJoin(plantations, eq(groups.plantacionId, plantations.id))
    .where(eq(trees.id, treeId));
}

/** Datos para nombrar el archivo de la foto de un árbol: lugar y periodo de su plantación + SubID. */
export async function getDatosNombreDeFoto(treeId: string) {
  const [fila] = await db
    .select({ subId: trees.subId, lugar: plantations.lugar, periodo: plantations.periodo })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .innerJoin(plantations, eq(groups.plantacionId, plantations.id))
    .where(eq(trees.id, treeId));
  return fila ?? null;
}
