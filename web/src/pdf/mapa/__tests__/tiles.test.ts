import { encuadrar, proyectar, type Encuadre, type LatLng } from '../proyeccion';
import {
  cantidadDeTiles,
  elegirZoom,
  partirEnPaquetes,
  TOPE_TILES,
  tilesDelZoom,
  urlDeTile,
  urlDisponibilidad,
  zonaDelZoom,
} from '../tiles';

/** A zoom 10, el encuadre arranca en el px (1000, 2000) del mundo y mide 300 × 200. */
const A_MANO: Encuadre = {
  zoom: 10,
  origen: { x: 1000, y: 2000 },
  ancho: 300,
  alto: 200,
  latitudCentro: 0,
};

const SAN_SEBASTIAN: LatLng = { lat: -27.36012, lng: -55.89744 };

/** Tile XYZ y posición dentro de él (0 a 1), con la fórmula estándar de OSM. */
function tileOsm({ lat, lng }: LatLng, zoom: number) {
  const n = 2 ** zoom;
  const radianes = (lat * Math.PI) / 180;
  const x = ((lng + 180) / 360) * n;
  const y = ((1 - Math.asinh(Math.tan(radianes)) / Math.PI) / 2) * n;
  return { x: Math.floor(x), y: Math.floor(y), dentroX: x % 1, dentroY: y % 1 };
}

test('los topes son 16 tiles en la ficha y 36 en el informe', () => {
  expect(TOPE_TILES).toEqual({ ficha: 16, informe: 36 });
});

describe('elegirZoom', () => {
  // z11: x 2000..2600 → tiles 7..10 (4), y 4000..4400 → 15..17 (3): 12 tiles.
  // z12: x 4000..5200 → 15..20 (6), y 8000..8800 → 31..34 (4): 24 tiles.
  // z13: x 8000..10400 → 31..40 (10), y 16000..17600 → 62..68 (7): 70 tiles.
  test('cuenta los tiles que tocan el encuadre', () => {
    expect(cantidadDeTiles(A_MANO, 10)).toBe(6);
    expect(cantidadDeTiles(A_MANO, 11)).toBe(12);
    expect(cantidadDeTiles(A_MANO, 12)).toBe(24);
    expect(cantidadDeTiles(A_MANO, 13)).toBe(70);
  });

  test('el más alto que entra en el tope de la ficha y en el del informe', () => {
    expect(elegirZoom(A_MANO, 16)).toBe(11);
    expect(elegirZoom(A_MANO, 36)).toBe(12);
  });

  test('nunca pasa de 19 aunque el encuadre pida más detalle', () => {
    const chiquito = { ...A_MANO, zoom: 21, ancho: 128, alto: 128 };
    expect(cantidadDeTiles(chiquito, 20)).toBeLessThanOrEqual(16);
    expect(elegirZoom(chiquito, 16)).toBe(19);
  });
});

describe('tilesDelZoom', () => {
  test('rango x/y y offset de cada tile, calculados a mano', () => {
    const tiles = tilesDelZoom(A_MANO, 11);
    expect(tiles).toHaveLength(12);
    // A z11 un tile mide 128 unidades del encuadre; el (7, 15) arranca en (896, 1920).
    expect(tiles[0]).toEqual({ z: 11, x: 7, y: 15, destino: { x: -104, y: -80 }, lado: 128 });
    expect(tiles.at(-1)).toEqual({ z: 11, x: 10, y: 17, destino: { x: 280, y: 176 }, lado: 128 });
  });

  test('al mismo zoom del encuadre, un tile mide 256 unidades', () => {
    const [primero] = tilesDelZoom(A_MANO, 10);
    expect(primero).toEqual({ z: 10, x: 3, y: 7, destino: { x: -232, y: -208 }, lado: 256 });
  });

  test.each([16, 17, 19])(
    'a zoom %i, el punto cae en el tile de OSM y en el mismo lugar dentro de él',
    (zoom) => {
      const encuadre = encuadrar([SAN_SEBASTIAN], 128, 128, { margen: 10, minimoMetros: 60 });
      const osm = tileOsm(SAN_SEBASTIAN, zoom);
      const tile = tilesDelZoom(encuadre, zoom).find((t) => t.x === osm.x && t.y === osm.y);
      expect(tile).toBeDefined();
      const punto = proyectar(encuadre, SAN_SEBASTIAN);
      expect((punto.x - tile!.destino.x) / tile!.lado).toBeCloseTo(osm.dentroX, 6);
      expect((punto.y - tile!.destino.y) / tile!.lado).toBeCloseTo(osm.dentroY, 6);
    },
  );
});

test('la URL del tile es la de Esri, con z/y/x en ese orden', () => {
  expect(urlDeTile({ z: 17, x: 45187, y: 75944 })).toBe(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/17/75944/45187',
  );
});

test('la zona del zoom es el rango x/y de los tiles', () => {
  expect(zonaDelZoom(A_MANO, 11)).toEqual({
    z: 11,
    x: { primero: 7, ultimo: 10 },
    y: { primero: 15, ultimo: 17 },
  });
});

test('el tilemap de Esri pide fila, columna, ancho y alto de la zona', () => {
  expect(urlDisponibilidad(zonaDelZoom(A_MANO, 11))).toBe(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tilemap/11/15/7/4/3',
  );
});

describe('partirEnPaquetes', () => {
  test('una zona dentro de un paquete de 128 × 128 queda entera', () => {
    const zona = { z: 17, x: { primero: 0, ultimo: 127 }, y: { primero: 5, ultimo: 9 } };
    expect(partirEnPaquetes(zona)).toEqual([zona]);
  });

  test('una zona que cruza en x y en y a la vez se parte en cuatro', () => {
    const zona = { z: 17, x: { primero: 126, ultimo: 129 }, y: { primero: 255, ultimo: 256 } };
    expect(partirEnPaquetes(zona)).toEqual([
      { z: 17, x: { primero: 126, ultimo: 127 }, y: { primero: 255, ultimo: 255 } },
      { z: 17, x: { primero: 128, ultimo: 129 }, y: { primero: 255, ultimo: 255 } },
      { z: 17, x: { primero: 126, ultimo: 127 }, y: { primero: 256, ultimo: 256 } },
      { z: 17, x: { primero: 128, ultimo: 129 }, y: { primero: 256, ultimo: 256 } },
    ]);
  });

  test('más de 128 columnas cruzando de fila: tres paquetes por fila, seis en total', () => {
    const zona = { z: 17, x: { primero: 100, ultimo: 300 }, y: { primero: 127, ultimo: 128 } };
    const partes = partirEnPaquetes(zona);
    expect(partes.slice(0, 3).map(({ x }) => x)).toEqual([
      { primero: 100, ultimo: 127 },
      { primero: 128, ultimo: 255 },
      { primero: 256, ultimo: 300 },
    ]);
    expect(partes.map(({ y }) => y.primero)).toEqual([127, 127, 127, 128, 128, 128]);
  });
});
