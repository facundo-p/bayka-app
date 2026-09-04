/**
 * Export query — returns all required columns for plantation export.
 */
import { db } from '../database/client';
import { trees, groups, plantations, parcelas, species } from '../database/schema';
import { eq, and, asc, isNotNull } from 'drizzle-orm';

/**
 * Fila para el export CSV/Excel. lugar/plantacionLugar resuelven ambos a plantations.lugar ("Zona"
 * es legacy, "Plantación" la columna nueva). parcelaNombre no es nullable (#90, INNER JOIN);
 * especieNombre sí (LEFT JOIN a species) — especie null/ausente no debe hacer desaparecer el árbol, se etiqueta "N/N".
 */
export interface ExportRow {
  globalId: number | null;
  idParcial: number | null;
  lugar: string;
  plantacionLugar: string;
  parcelaNombre: string;
  grupoNombre: string;
  subId: string;
  periodo: string;
  especieNombre: string | null;
}

/** Filas de export ordenadas por globalId ASC; ver `ExportRow` para el porqué de los JOIN. */
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
    .innerJoin(parcelas, eq(groups.parcelaId, parcelas.id))
    .leftJoin(species, eq(trees.especieId, species.id))
    .where(eq(groups.plantacionId, plantacionId))
    .orderBy(asc(trees.globalId));
}

/** Fila del export KML (solo árboles con coordenadas); especieNombre nullable (N/N se exporta como "N/N"), parcelaNombre no (#90). */
export interface KmlExportRow {
  subId: string;
  posicion: number;
  especieNombre: string | null;
  grupoNombre: string;
  parcelaNombre: string;
  latitude: number;
  longitude: number;
  gpsAccuracy: number | null;
  gpsCapturedAt: string | null;
}

/** Árboles con GPS, ordenados parcela → grupo → posición (el generador KML agrupa en folders preservando este orden). */
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
    .innerJoin(parcelas, eq(groups.parcelaId, parcelas.id))
    .leftJoin(species, eq(trees.especieId, species.id))
    .where(and(
      eq(groups.plantacionId, plantacionId),
      isNotNull(trees.latitude),
      isNotNull(trees.longitude),
    ))
    .orderBy(asc(parcelas.nombre), asc(groups.nombre), asc(trees.posicion));
  return rows as KmlExportRow[];
}
