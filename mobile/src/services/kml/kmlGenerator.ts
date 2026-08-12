/**
 * Generación pura del XML KML (sin I/O): testeable por snapshot.
 * Coordenadas en orden KML: lon,lat. Todo texto pasa por escapeXml.
 */
import type { KmlExportRow } from '../../queries/exportQueries';
import { buildSpeciesStyles, getSpeciesStyleId } from './speciesStyles';

export const NN_SPECIES_LABEL = 'N/N';

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function especieLabel(row: KmlExportRow): string {
  return row.especieNombre ?? NN_SPECIES_LABEL;
}

function buildDescription(row: KmlExportRow): string {
  const precision = row.gpsAccuracy !== null ? `± ${Math.round(row.gpsAccuracy)} m` : 's/d';
  const lineas = [
    `Especie: ${especieLabel(row)}`,
    `Grupo: ${row.grupoNombre}`,
    `Parcela: ${row.parcelaNombre}`,
    `Posición: ${row.posicion}`,
    `Precisión: ${precision}`,
    `Capturado: ${row.gpsCapturedAt ?? 's/d'}`,
  ];
  return escapeXml(lineas.join('\n'));
}

function buildPlacemark(row: KmlExportRow): string {
  return [
    '        <Placemark>',
    `          <name>${escapeXml(row.subId)}</name>`,
    `          <styleUrl>#${getSpeciesStyleId(especieLabel(row))}</styleUrl>`,
    `          <description>${buildDescription(row)}</description>`,
    `          <Point><coordinates>${row.longitude},${row.latitude}</coordinates></Point>`,
    '        </Placemark>',
  ].join('\n');
}

/** Agrupa preservando el orden de llegada de las claves. */
function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

function buildGroupFolder(grupoNombre: string, rows: KmlExportRow[]): string {
  return [
    '      <Folder>',
    `        <name>${escapeXml(grupoNombre)}</name>`,
    rows.map(buildPlacemark).join('\n'),
    '      </Folder>',
  ].join('\n');
}

function buildParcelaFolder(parcelaNombre: string, rows: KmlExportRow[]): string {
  const porGrupo = groupBy(rows, (row) => row.grupoNombre);
  const folders = [...porGrupo.entries()]
    .map(([grupo, groupRows]) => buildGroupFolder(grupo, groupRows))
    .join('\n');
  return [
    '    <Folder>',
    `      <name>${escapeXml(parcelaNombre)}</name>`,
    folders,
    '    </Folder>',
  ].join('\n');
}

/** Documento KML completo: estilos por especie + folders parcela → grupo. */
export function buildKml(plantationName: string, rows: KmlExportRow[]): string {
  const especies = [...new Set(rows.map(especieLabel))];
  const porParcela = groupBy(rows, (row) => row.parcelaNombre);
  const folders = [...porParcela.entries()]
    .map(([parcela, parcelaRows]) => buildParcelaFolder(parcela, parcelaRows))
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '  <Document>',
    `    <name>${escapeXml(plantationName)}</name>`,
    buildSpeciesStyles(especies),
    folders,
    '  </Document>',
    '</kml>',
    '',
  ].join('\n');
}
