/**
 * Export query — returns all required columns for plantation export.
 *
 * Covers: EXPO-03, EXPO-PARC-01, EXPO-PARC-02
 */
import { db } from '../database/client';
import { trees, groups, plantations, parcelas, species } from '../database/schema';
import { eq, and, asc, isNotNull } from 'drizzle-orm';

/**
 * Row shape for the CSV/Excel export.
 *
 * NOTE on `lugar` vs `plantacionLugar` (D-18-09):
 * Both currently resolve to `plantations.lugar`. The "Zona" column is kept
 * for backwards compatibility while "Plantación" is the new column.
 * If the team decides to collapse them, it's a 1-line refactor (drop one field
 * + drop the matching column in ExportService).
 *
 * `parcelaNombre` is nullable because LEFT JOIN to `parcelas`: legacy groups
 * without `parcelaId` produce `null`. Consumer normalizes `?? ''` (D-18-10).
 *
 * `especieNombre` es nullable por el LEFT JOIN a `species`: un árbol cuya
 * `especieId` es null o apunta a una especie ausente del catálogo local (especie
 * huérfana por sync incompleto) NO debe desaparecer del export — el INNER JOIN
 * previo lo descartaba en silencio. El consumidor lo etiqueta "N/N" para que el
 * problema sea visible en la planilla en vez de perder el árbol.
 */
export interface ExportRow {
  globalId: number | null;
  idParcial: number | null;
  lugar: string;
  plantacionLugar: string;
  parcelaNombre: string | null;
  grupoNombre: string;
  subId: string;
  periodo: string;
  especieNombre: string | null;
}

/**
 * EXPO-03 / EXPO-PARC-01 / EXPO-PARC-02
 * Returns all tree rows with required export columns, ordered by globalId ASC.
 * JOIN: trees → groups → plantations; LEFT JOIN a parcelas y a species.
 *
 * `species` va por LEFT JOIN a propósito: con INNER JOIN, un árbol con
 * `especieId` null o huérfano (especie no presente en el catálogo local) se
 * caía del export sin aviso. Con LEFT JOIN el árbol siempre sale y el consumidor
 * lo marca "N/N".
 */
export async function getExportRows(plantacionId: string): Promise<ExportRow[]> {
  return db
    .select({
      globalId: trees.globalId,
      idParcial: trees.plantacionId,
      lugar: plantations.lugar,
      plantacionLugar: plantations.lugar,
      parcelaNombre: parcelas.nombre,
      grupoNombre: groups.nombre,
      subId: trees.subId,
      periodo: plantations.periodo,
      especieNombre: species.nombre,
    })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .innerJoin(plantations, eq(groups.plantacionId, plantations.id))
    .leftJoin(parcelas, eq(groups.parcelaId, parcelas.id))
    .leftJoin(species, eq(trees.especieId, species.id))
    .where(eq(groups.plantacionId, plantacionId))
    .orderBy(asc(trees.globalId));
}

/**
 * Row del export KML: solo árboles CON coordenadas. `especieNombre` nullable
 * (N/N sin resolver se exporta con etiqueta "N/N").
 */
export interface KmlExportRow {
  subId: string;
  posicion: number;
  especieNombre: string | null;
  grupoNombre: string;
  parcelaNombre: string | null;
  latitude: number;
  longitude: number;
  gpsAccuracy: number | null;
  gpsCapturedAt: string | null;
}

/**
 * Árboles con punto GPS de la plantación, ordenados por parcela → grupo →
 * posición (el generador KML agrupa en folders preservando este orden).
 */
export async function getKmlExportRows(plantacionId: string): Promise<KmlExportRow[]> {
  const rows = await db
    .select({
      subId: trees.subId,
      posicion: trees.posicion,
      especieNombre: species.nombre,
      grupoNombre: groups.nombre,
      parcelaNombre: parcelas.nombre,
      latitude: trees.latitude,
      longitude: trees.longitude,
      gpsAccuracy: trees.gpsAccuracy,
      gpsCapturedAt: trees.gpsCapturedAt,
    })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .leftJoin(parcelas, eq(groups.parcelaId, parcelas.id))
    .leftJoin(species, eq(trees.especieId, species.id))
    .where(and(
      eq(groups.plantacionId, plantacionId),
      isNotNull(trees.latitude),
      isNotNull(trees.longitude),
    ))
    .orderBy(asc(parcelas.nombre), asc(groups.nombre), asc(trees.posicion));
  return rows as KmlExportRow[];
}
