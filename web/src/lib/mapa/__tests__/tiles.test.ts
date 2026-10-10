import {
  partirEnPaquetes,
  urlDeTile,
  urlDisponibilidad,
  zonaDelZoom,
  type AreaMundo,
} from '../tiles';

/** A zoom 10, el área arranca en el px (1000, 2000) del mundo y mide 300 × 200. */
const A_MANO: AreaMundo = { zoom: 10, origen: { x: 1000, y: 2000 }, ancho: 300, alto: 200 };

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
