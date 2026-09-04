// Tests del generador KML puro: estructura, escaping, orden lon/lat, estilos.

import type { KmlExportRow } from '../../src/queries/exportQueries';
import { buildKml, escapeXml } from '../../src/services/kml/kmlGenerator';
import { getSpeciesStyleId } from '../../src/services/kml/speciesStyles';

function row(overrides: Partial<KmlExportRow> = {}): KmlExportRow {
  return {
    subId: 'PL1EUC1',
    posicion: 1,
    especieNombre: 'Eucalipto',
    grupoNombre: 'Línea 1',
    parcelaNombre: 'Lote A',
    latitude: -31.5,
    longitude: -60.7,
    gpsAccuracy: 2.4,
    gpsCapturedAt: '2026-06-10T12:00:00',
    ...overrides,
  };
}

describe('escapeXml', () => {
  it('escapa &, <, >, comillas y apóstrofes', () => {
    expect(escapeXml(`Ñandubay & <Algarrobo> "blanco" 'sur'`)).toBe(
      'Ñandubay &amp; &lt;Algarrobo&gt; &quot;blanco&quot; &apos;sur&apos;',
    );
  });
});

describe('getSpeciesStyleId', () => {
  it('es determinístico y sin acentos/espacios', () => {
    expect(getSpeciesStyleId('Ñandubay Colorado')).toBe(getSpeciesStyleId('Ñandubay Colorado'));
    expect(getSpeciesStyleId('Ñandubay Colorado')).toMatch(/^especie-[a-z0-9-]+$/);
  });
});

describe('buildKml', () => {
  it('estructura completa: documento, estilo por especie, folders parcela→grupo, placemark', () => {
    const kml = buildKml('Campo Norte', [row()]);
    expect(kml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
    expect(kml).toContain('<name>Campo Norte</name>');
    expect(kml).toContain(`<Style id="${getSpeciesStyleId('Eucalipto')}">`);
    expect(kml).toContain('<name>Lote A</name>');
    expect(kml).toContain('<name>Línea 1</name>');
    expect(kml).toContain('<name>PL1EUC1</name>');
    expect(kml).toContain(`<styleUrl>#${getSpeciesStyleId('Eucalipto')}</styleUrl>`);
  });

  it('coordenadas en orden KML lon,lat', () => {
    const kml = buildKml('Campo', [row({ latitude: -31.5, longitude: -60.7 })]);
    expect(kml).toContain('<coordinates>-60.7,-31.5</coordinates>');
  });

  it('un solo <Style> compartido por especie aunque haya varios placemarks', () => {
    const kml = buildKml('Campo', [
      row(),
      row({ subId: 'PL1EUC2', posicion: 2 }),
    ]);
    const styleCount = kml.split(`<Style id="${getSpeciesStyleId('Eucalipto')}">`).length - 1;
    expect(styleCount).toBe(1);
    const placemarkCount = kml.split('<Placemark>').length - 1;
    expect(placemarkCount).toBe(2);
  });

  it('caracteres especiales (ñ, acentos, &, <) no rompen el XML', () => {
    const kml = buildKml('Campo & <Sur>', [
      row({ especieNombre: 'Ñandubay <rojo>', grupoNombre: 'Línea & 1', subId: 'P"L1"Ñ1' }),
    ]);
    expect(kml).toContain('<name>Campo &amp; &lt;Sur&gt;</name>');
    expect(kml).toContain('Especie: Ñandubay &lt;rojo&gt;');
    expect(kml).toContain('<name>P&quot;L1&quot;Ñ1</name>');
    expect(kml).not.toMatch(/<name>[^<]*<rojo>/);
  });

  it('especies con nombres que slugifican igual comparten un único <Style> (sin id duplicado)', () => {
    const kml = buildKml('Campo', [
      row({ especieNombre: 'Pino A', subId: 'P1' }),
      row({ especieNombre: 'Pino-A', subId: 'P2' }),
    ]);
    expect(getSpeciesStyleId('Pino A')).toBe(getSpeciesStyleId('Pino-A'));
    const styleCount = kml.split(`<Style id="${getSpeciesStyleId('Pino A')}">`).length - 1;
    expect(styleCount).toBe(1);
  });

  it('nombre sin caracteres alfanuméricos no produce id vacío', () => {
    expect(getSpeciesStyleId('—')).toBe('especie-sin-nombre');
  });

  it('árbol N/N (sin especie resuelta) se incluye con etiqueta N/N', () => {
    const kml = buildKml('Campo', [row({ especieNombre: null })]);
    expect(kml).toContain('Especie: N/N');
    expect(kml).toContain(`<styleUrl>#${getSpeciesStyleId('N/N')}</styleUrl>`);
  });

  it('la descripción incluye especie, grupo, parcela, posición, precisión y fecha', () => {
    const kml = buildKml('Campo', [row()]);
    expect(kml).toContain('Especie: Eucalipto');
    expect(kml).toContain('Grupo: Línea 1');
    expect(kml).toContain('Parcela: Lote A');
    expect(kml).toContain('Posición: 1');
    expect(kml).toContain('Precisión: ± 2 m');
    expect(kml).toContain('Capturado: 2026-06-10T12:00:00');
  });

  it('snapshot de la estructura completa', () => {
    const kml = buildKml('Campo Norte', [
      row(),
      row({ subId: 'PL1NN2', posicion: 2, especieNombre: null, gpsAccuracy: null }),
      row({ subId: 'PL2EUC1', grupoNombre: 'Línea 2', latitude: -31.6 }),
    ]);
    expect(kml).toMatchSnapshot();
  });
});
