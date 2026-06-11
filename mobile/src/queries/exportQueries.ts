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
  especieNombre: string;
}

/**
 * EXPO-03 / EXPO-PARC-01 / EXPO-PARC-02
 * Returns all tree rows with required export columns, ordered by globalId ASC.
 * JOIN: trees → groups → plantations, trees → species, groups LEFT JOIN parcelas.
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
    .innerJoin(species, eq(trees.especieId, species.id))
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
