import type { LatLng } from '../../../../../shared/distancia';
import {
  aspectoDe,
  LADO_TILE,
  encuadrar,
  metrosPorPixel,
  pixelDelMundo,
  proyectar,
} from '../proyeccion';

const SAN_SEBASTIAN: LatLng = { lat: -27.36012, lng: -55.89744 };
const OPCIONES = { margen: 10, minimoMetros: 60 };

/** Tile XYZ que contiene el punto, con la fórmula estándar de OSM. */
function tileOsm({ lat, lng }: LatLng, zoom: number) {
  const n = 2 ** zoom;
  const radianes = (lat * Math.PI) / 180;
  return {
    x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(((1 - Math.asinh(Math.tan(radianes)) / Math.PI) / 2) * n),
  };
}

describe('pixelDelMundo', () => {
  test('a zoom 0 el mundo mide un tile y (0, 0) cae en el centro', () => {
    expect(pixelDelMundo({ lat: 0, lng: 0 }, 0)).toEqual({ x: LADO_TILE / 2, y: LADO_TILE / 2 });
  });

  test.each([10, 16, 19])('cae en el mismo tile XYZ que calcula OSM a zoom %i', (zoom) => {
    const pixel = pixelDelMundo(SAN_SEBASTIAN, zoom);
    expect({
      x: Math.floor(pixel.x / LADO_TILE),
      y: Math.floor(pixel.y / LADO_TILE),
    }).toEqual(tileOsm(SAN_SEBASTIAN, zoom));
  });
});

describe('metrosPorPixel', () => {
  test('en el ecuador a zoom 0 un px son unos 156 km', () => {
    expect(metrosPorPixel(0, 0)).toBeCloseTo(156543.03, 1);
  });

  test('cada zoom más es la mitad', () => {
    expect(metrosPorPixel(-27, 15)).toBeCloseTo(metrosPorPixel(-27, 14) / 2, 6);
  });
});

describe('encuadrar', () => {
  const puntos: LatLng[] = [
    SAN_SEBASTIAN,
    { lat: -27.3611, lng: -55.8962 },
    { lat: -27.3597, lng: -55.8981 },
  ];

  test('todos los puntos quedan adentro, con el margen', () => {
    const encuadre = encuadrar(puntos, 128, 128, OPCIONES);
    for (const punto of puntos) {
      const { x, y } = proyectar(encuadre, punto);
      expect(x).toBeGreaterThanOrEqual(OPCIONES.margen - 1e-9);
      expect(x).toBeLessThanOrEqual(128 - OPCIONES.margen + 1e-9);
      expect(y).toBeGreaterThanOrEqual(OPCIONES.margen - 1e-9);
      expect(y).toBeLessThanOrEqual(128 - OPCIONES.margen + 1e-9);
    }
  });

  test('el lado más ajustado toca el margen: es el zoom más alto posible', () => {
    const encuadre = encuadrar(puntos, 128, 128, OPCIONES);
    const xs = puntos.map((punto) => proyectar(encuadre, punto).x);
    const ys = puntos.map((punto) => proyectar(encuadre, punto).y);
    const usado = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    expect(usado).toBeCloseTo(128 - 2 * OPCIONES.margen, 6);
  });

  test('un punto solo queda en el centro con el lado mínimo en metros', () => {
    const encuadre = encuadrar([SAN_SEBASTIAN], 128, 128, OPCIONES);
    const centro = proyectar(encuadre, SAN_SEBASTIAN);
    expect(centro.x).toBeCloseTo(64, 6);
    expect(centro.y).toBeCloseTo(64, 6);
    const metrosVisibles =
      (128 - 2 * OPCIONES.margen) * metrosPorPixel(SAN_SEBASTIAN.lat, encuadre.zoom);
    expect(metrosVisibles).toBeCloseTo(OPCIONES.minimoMetros, 3);
  });

  test('sin puntos no hay encuadre', () => {
    expect(() => encuadrar([], 128, 128, OPCIONES)).toThrow();
  });
});

describe('aspectoDe', () => {
  test('ancho sobre alto de lo que ocupan los puntos', () => {
    const ancha = [
      { lat: -27.47, lng: -55.9 },
      { lat: -27.48, lng: -55.85 },
    ];
    expect(aspectoDe(ancha, 60)).toBeGreaterThan(4);
    const alta = [
      { lat: -27.4, lng: -55.9 },
      { lat: -27.45, lng: -55.901 },
    ];
    expect(aspectoDe(alta, 60)).toBeLessThan(1);
  });

  test('un punto solo es cuadrado, y sin puntos también', () => {
    expect(aspectoDe([{ lat: -27.47, lng: -55.9 }], 60)).toBeCloseTo(1);
    expect(aspectoDe([], 60)).toBe(1);
  });
});
