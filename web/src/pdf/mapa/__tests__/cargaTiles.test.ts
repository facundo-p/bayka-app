import { crearFuenteTiles, type DependenciasTiles } from '../cargaTiles';
import type { TileXYZ, ZonaTiles } from '../tiles';

const TILES: TileXYZ[] = [
  { z: 17, x: 1, y: 2 },
  { z: 17, x: 2, y: 2 },
];

const ZONA: ZonaTiles = { z: 17, x: { primero: 10, ultimo: 11 }, y: { primero: 20, ultimo: 20 } };

type Respuesta = { status: number; json?: unknown };

function respuesta({ status, json }: Respuesta): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    blob: async () => new Blob(['jpg']),
    json: async () => json,
  } as Response;
}

/** `bajar` responde según la URL; `decodificar` da imágenes falsas con `close`. */
function dependencias(responder: (url: string) => Respuesta = () => ({ status: 200 })) {
  const imagenes: { close: ReturnType<typeof vi.fn> }[] = [];
  const deps = {
    bajar: vi.fn<DependenciasTiles['bajar']>(async (url) => respuesta(responder(url))),
    decodificar: vi.fn(async () => {
      const imagen = { close: vi.fn() };
      imagenes.push(imagen);
      return imagen as unknown as ImageBitmap;
    }),
  } satisfies DependenciasTiles;
  return { deps, imagenes };
}

const tilemap = (data: number[], location = { left: 10, top: 20, width: 2, height: 1 }) => ({
  status: 200,
  json: { data, location, valid: true },
});

describe('cargar', () => {
  test('pide cada tile a Esri y lleva su señal de timeout', async () => {
    const { deps } = dependencias();
    await crearFuenteTiles(deps).cargar(TILES);
    expect(deps.bajar.mock.calls.map(([url]) => url)).toEqual([
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/17/2/1',
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/17/2/2',
    ]);
    expect(deps.bajar.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
  });

  test('dos mapas con los mismos tiles piden cada tile una sola vez', async () => {
    const { deps } = dependencias();
    const fuente = crearFuenteTiles(deps);
    const [primero, segundo] = await Promise.all([fuente.cargar(TILES), fuente.cargar(TILES)]);
    await fuente.cargar([...TILES].reverse());
    expect(deps.bajar).toHaveBeenCalledTimes(2);
    expect(primero).toHaveLength(2);
    expect(segundo).toHaveLength(2);
  });

  test('si un tile falla, rechaza y ese tile se reintenta en el próximo pedido', async () => {
    let fallar = true;
    const { deps } = dependencias((url) => ({
      status: url.endsWith('/2/2') && fallar ? 500 : 200,
    }));
    const fuente = crearFuenteTiles(deps);
    await expect(fuente.cargar(TILES)).rejects.toThrow();
    fallar = false;
    await expect(fuente.cargar(TILES)).resolves.toHaveLength(2);
    // El que anduvo quedó en la caché; el que falló se volvió a pedir.
    expect(deps.bajar).toHaveBeenCalledTimes(3);
  });

  test('si una imagen no se decodifica, cierra las otras y rechaza', async () => {
    const { deps, imagenes } = dependencias();
    deps.decodificar.mockRejectedValueOnce(new Error('jpeg roto'));
    await expect(crearFuenteTiles(deps).cargar(TILES)).rejects.toThrow();
    expect(imagenes).toHaveLength(1);
    expect(imagenes[0].close).toHaveBeenCalled();
  });
});

describe('tieneImagen', () => {
  test('pregunta al tilemap de Esri por la zona entera', async () => {
    const { deps } = dependencias(() => tilemap([1, 1]));
    await expect(crearFuenteTiles(deps).tieneImagen(ZONA)).resolves.toBe(true);
    expect(deps.bajar.mock.calls[0][0]).toBe(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tilemap/17/20/10/2/1',
    );
  });

  test('con un solo tile sin imagen, la zona no tiene', async () => {
    const { deps } = dependencias(() => tilemap([1, 0]));
    await expect(crearFuenteTiles(deps).tieneImagen(ZONA)).resolves.toBe(false);
  });

  test('si Esri recorta el tilemap y deja tiles afuera, no los da por buenos', async () => {
    const recortado = { left: 10, top: 20, width: 1, height: 1 };
    const { deps } = dependencias(() => tilemap([1], recortado));
    await expect(crearFuenteTiles(deps).tieneImagen(ZONA)).resolves.toBe(false);
  });

  test('una zona que cruza de paquete se pregunta por partes', async () => {
    const cruzada = { z: 17, x: { primero: 127, ultimo: 128 }, y: { primero: 5, ultimo: 5 } };
    const { deps } = dependencias((url) => {
      const [x] = url.split('/').slice(-3);
      return tilemap([1], { left: Number(x), top: 5, width: 1, height: 1 });
    });
    await expect(crearFuenteTiles(deps).tieneImagen(cruzada)).resolves.toBe(true);
    expect(deps.bajar).toHaveBeenCalledTimes(2);
  });

  test('si el tilemap no responde, rechaza y se vuelve a preguntar en el próximo mapa', async () => {
    let caido = true;
    const { deps } = dependencias(() => (caido ? { status: 500 } : tilemap([1, 1])));
    const fuente = crearFuenteTiles(deps);
    await expect(fuente.tieneImagen(ZONA)).rejects.toThrow();
    caido = false;
    await expect(fuente.tieneImagen(ZONA)).resolves.toBe(true);
  });
});
