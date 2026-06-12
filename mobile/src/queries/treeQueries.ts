import { desc, eq } from 'drizzle-orm';
import { db } from '../database/client';
import { species, trees } from '../database/schema';

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
 * científico) y punto GPS completo (lat/lng/precisión/momento de captura).
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
    })
    .from(trees)
    .leftJoin(species, eq(trees.especieId, species.id))
    .where(eq(trees.id, treeId));
}
