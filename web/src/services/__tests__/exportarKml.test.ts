import { COLOR_GRAFICO_NN } from '../../theme/chartColors';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import type { PuntoGps } from '../../queries/mapaQueries';
import { construirKml, nombreArchivoKml } from '../exportarKml';

const OPCIONES = { nombreDocumento: 'Puntos GPS – Sitio (2025)' };

function punto(parcial: Partial<PuntoGps>): PuntoGps {
  return { lat: -31.4, lng: -64.2, codigo: 'QB', nombre: 'Quebracho', ...parcial };
}

/** #rrggbb → color KML aabbggrr (alfa opaco + BGR), como lo arma el servicio. */
function colorKml(hex: string): string {
  const rgb = hex.replace('#', '');
  return `ff${rgb.slice(4, 6)}${rgb.slice(2, 4)}${rgb.slice(0, 2)}`;
}

describe('construirKml', () => {
  test('un placemark por árbol con coordenadas en orden lng,lat,0', () => {
    const kml = construirKml([punto({ lat: -31.4, lng: -64.2 })], OPCIONES);
    expect(kml).toContain('<coordinates>-64.2,-31.4,0</coordinates>');
    expect(kml.match(/<Placemark>/g)).toHaveLength(1);
  });

  test('KML válido: cabecera XML y raíz kml/Document con el nombre escapado', () => {
    const kml = construirKml([punto({})], OPCIONES);
    expect(kml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
    expect(kml).toContain('<name>Puntos GPS – Sitio (2025)</name>');
  });

  test('agrupa por especie en un Folder por especie', () => {
    const kml = construirKml(
      [
        punto({ codigo: 'QB', nombre: 'Quebracho' }),
        punto({ codigo: 'QB', nombre: 'Quebracho' }),
        punto({ codigo: 'AL', nombre: 'Algarrobo' }),
      ],
      OPCIONES,
    );
    expect(kml.match(/<Folder>/g)).toHaveLength(2);
    expect(kml.match(/<Placemark>/g)).toHaveLength(3);
    expect(kml).toContain('<name>Quebracho</name>');
    expect(kml).toContain('<name>Algarrobo</name>');
  });

  test('color del estilo = color estable de la especie, en formato KML', () => {
    const kml = construirKml([punto({ codigo: 'QB' })], OPCIONES);
    expect(kml).toContain(`<color>${colorKml(colorEspeciePorCodigo('QB'))}</color>`);
  });

  test('especie sin identificar (NN) usa el ámbar por defecto y "Sin identificar"', () => {
    const kml = construirKml([punto({ codigo: 'NN', nombre: 'x' })], OPCIONES);
    expect(kml).toContain('<name>Sin identificar</name>');
    expect(kml).toContain(`<color>${colorKml(COLOR_GRAFICO_NN)}</color>`);
  });

  test('escapa caracteres XML reservados en nombres y códigos', () => {
    const kml = construirKml(
      [punto({ codigo: 'A&B', nombre: `Ñandubay <"'> & árbol` })],
      { nombreDocumento: 'Doc & <título>' },
    );
    expect(kml).toContain('Ñandubay &lt;&quot;&apos;&gt; &amp; árbol');
    expect(kml).toContain('Doc &amp; &lt;título&gt;');
    expect(kml).toContain('A&amp;B');
    expect(kml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });
});

describe('nombreArchivoKml', () => {
  test('slug seguro: minúsculas, sin acentos ni símbolos', () => {
    expect(nombreArchivoKml('Estancia Ñañdú', '2024/2025')).toBe(
      'puntos-gps-estancia-nandu-2024-2025.kml',
    );
  });

  test('omite partes vacías tras el slug', () => {
    expect(nombreArchivoKml('!!!', '2025')).toBe('puntos-gps-2025.kml');
  });
});
