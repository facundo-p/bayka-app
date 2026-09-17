/**
 * Export query — returns all required columns for plantation export.
 */
import { db } from '../database/client';
import { trees, groups, plantations, parcelas, species } from '../database/schema';
import { eq, and, asc, isNotNull } from 'drizzle-orm';

/**
 * Fila para el export CSV/Excel. lugar/plantacionLugar resuelven ambos a plantations.lugar ("Zona"
 * es legacy, "Plantación" la columna nueva). parcelaNombre y especieNombre son nullables: un árbol
 * nunca debe caerse del export por una parcela borrada o una especie ausente, se serializan
 * vacío y "N/N" respectivamente (mismo criterio que la web).
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

/** Null si la parcela está tombstoned: su nombre no debe aparecer en la planilla. */
function nombreVigente(nombre: string | null, borradaEn: string | null): string | null {
  return borradaEn === null ? nombre : null;
}

/** Filas de export ordenadas por globalId ASC; ver `ExportRow` para el porqué de los JOIN. */
export async function getExportRows(plantacionId: string): Promise<ExportRow[]> {
  const filas = await db
    .select({
      globalId: trees.globalId,
      idParcial: trees.plantacionId,
      lugar: plantations.lugar,
      plantacionLugar: plantations.lugar,
      parcelaNombre: parcelas.nombre,
      parcelaBorradaEn: parcelas.deletedAt,
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

  return filas.map(({ parcelaBorradaEn, ...fila }) => ({
    ...fila,
    parcelaNombre: nombreVigente(fila.parcelaNombre, parcelaBorradaEn),
  }));
}

/** Fila del export KML (solo árboles con coordenadas); especieNombre y parcelaNombre nullables:
 *  el generador les pone etiqueta ("N/N" / "Sin parcela") en vez de perder el punto. */
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

/** Árboles con GPS, ordenados parcela → grupo → posición (el generador KML agrupa en folders preservando este orden). */
export async function getKmlExportRows(plantacionId: string): Promise<KmlExportRow[]> {
  const filas = await db
    .select({
      subId: trees.subId,
      posicion: trees.posicion,
      especieNombre: species.nombre,
      grupoNombre: groups.nombre,
      parcelaNombre: parcelas.nombre,
      parcelaBorradaEn: parcelas.deletedAt,
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

  return filas.map(({ parcelaBorradaEn, ...fila }) => ({
    ...fila,
    parcelaNombre: nombreVigente(fila.parcelaNombre, parcelaBorradaEn),
  })) as KmlExportRow[];
}
