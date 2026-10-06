import { senalConEspera } from '../../../lib/espera';
import { crearFuenteTiles, type DependenciasTiles } from '../cargaTiles';
import type { TileXYZ, ZonaTiles } from '../tiles';

const TILES: TileXYZ[] = [
  { z: 17, x: 1, y: 2 },
  { z: 17, x: 2, y: 2 },
];

const ZONA: ZonaTiles = { z: 17, x: { primero: 10, ultimo: 11 }, y: { primero: 20, ultimo: 20 } };
const ESPERA_MS = 8000;
const PAUSA_MS = 60_000;

type Respuesta = { status: number; json?: unknown; tipo?: string };

function respuesta({ status, json, tipo = 'image/jpeg' }: Respuesta): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': tipo }),
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
    // El timer propio y no el nativo: los timers falsos lo pueden adelantar.
    senalDeEspera: (ms: number) => senalConEspera(ms, false),
  } satisfies DependenciasTiles;
  return { deps, imagenes };
}

/** Un Esri que no contesta: el pedido solo termina cuando la señal aborta. */
function sinRespuesta(url: string, senal: AbortSignal): Promise<Response> {
  return new Promise((_, rechazar) =>
    senal.addEventListener('abort', () => rechazar(new Error(`espera vencida: ${url}`))),
  );
}

const tilemap = (data: number[], location = { left: 10, top: 20, width: 2, height: 1 }) => ({
  status: 200,
  json: { data, location, valid: true },
});

const tile = (x: number): TileXYZ => ({ z: 17, x, y: 0 });

afterEach(() => vi.useRealTimers());

describe('cargar', () => {
  test('pide cada tile a Esri', async () => {
    const { deps } = dependencias();
    await crearFuenteTiles(deps).cargar(TILES);
    expect(deps.bajar.mock.calls.map(([url]) => url)).toEqual([
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/17/2/1',
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/17/2/2',
    ]);
  });

  test('la señal de cada pedido aborta a los 8 s sin respuesta', async () => {
    vi.useFakeTimers();
    const { deps } = dependencias();
    deps.bajar.mockImplementation(sinRespuesta);
    const pedido = crearFuenteTiles(deps).cargar(TILES.slice(0, 1));
    const rechazo = expect(pedido).rejects.toThrow('espera vencida');
    const senal = deps.bajar.mock.calls[0][1];
    await vi.advanceTimersByTimeAsync(ESPERA_MS - 1);
    expect(senal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(senal.aborted).toBe(true);
    await rechazo;
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

  test('un 200 que no es imagen (portal cautivo) falla y no queda en la caché', async () => {
    let portal = true;
    const { deps } = dependencias(() => ({
      status: 200,
      tipo: portal ? 'text/html' : 'image/jpeg',
    }));
    const fuente = crearFuenteTiles(deps);
    await expect(fuente.cargar(TILES.slice(0, 1))).rejects.toThrow('no es una imagen');
    portal = false;
    await expect(fuente.cargar(TILES.slice(0, 1))).resolves.toHaveLength(1);
    expect(deps.bajar).toHaveBeenCalledTimes(2);
  });

  test('si una imagen no se decodifica, cierra las otras y rechaza', async () => {
    const { deps, imagenes } = dependencias();
    deps.decodificar.mockRejectedValueOnce(new Error('jpeg roto'));
    await expect(crearFuenteTiles(deps).cargar(TILES)).rejects.toThrow();
    expect(imagenes).toHaveLength(1);
    expect(imagenes[0].close).toHaveBeenCalled();
  });
});

describe('caché', () => {
  const MIL = Array.from({ length: 1000 }, (_, indice) => tile(indice + 1));

  test('con 1000 entradas, la más vieja se desaloja y se vuelve a pedir', async () => {
    const { deps } = dependencias();
    const fuente = crearFuenteTiles(deps);
    await fuente.cargar([tile(0)]);
    await fuente.cargar(MIL);
    await fuente.cargar([tile(0)]);
    expect(deps.bajar).toHaveBeenCalledTimes(1002);
  });

  test('un pedido viejo que falla no borra al nuevo de la misma clave', async () => {
    let rechazarPrimero: (motivo: Error) => void = () => {};
    const { deps } = dependencias();
    deps.bajar.mockImplementationOnce(
      () => new Promise<Response>((_, rechazar) => (rechazarPrimero = rechazar)),
    );
    const fuente = crearFuenteTiles(deps);
    const primero = expect(fuente.cargar([tile(0)])).rejects.toThrow('viejo');
    await fuente.cargar(MIL);
    await fuente.cargar([tile(0)]);
    rechazarPrimero(new Error('viejo'));
    await primero;
    await fuente.cargar([tile(0)]);
    expect(deps.bajar.mock.calls.filter(([url]) => url.endsWith('/0/0'))).toHaveLength(2);
  });
});

describe('cortacircuito', () => {
  test('tras una espera vencida, lo encolado y lo siguiente fallan sin esperar', async () => {
    vi.useFakeTimers();
    const { deps } = dependencias();
    deps.bajar.mockImplementation(sinRespuesta);
    const fuente = crearFuenteTiles(deps);
    // 50 mapas de parcelas distintas: cada uno pide su zona.
    const zonas = Array.from({ length: 50 }, (_, indice) => ({
      ...ZONA,
      x: { primero: indice * 4, ultimo: indice * 4 + 1 },
    }));
    const resultados = Promise.allSettled(zonas.map((zona) => fuente.tieneImagen(zona)));
    await vi.advanceTimersByTimeAsync(ESPERA_MS);
    const terminados = await resultados;
    expect(terminados.every(({ status }) => status === 'rejected')).toBe(true);
    // Solo los 6 primeros llegaron a pedir; el resto cortó en el acto.
    expect(deps.bajar).toHaveBeenCalledTimes(6);
  });

  test('un 404 no es una caída: el pedido siguiente vuelve a llegar a Esri', async () => {
    const { deps } = dependencias(() => ({ status: 404 }));
    const fuente = crearFuenteTiles(deps);
    await expect(fuente.cargar(TILES.slice(0, 1))).rejects.toThrow('404');
    await expect(fuente.cargar(TILES.slice(1))).rejects.toThrow('404');
    expect(deps.bajar).toHaveBeenCalledTimes(2);
  });

  test('un tilemap inválido no es una caída: el pedido siguiente vuelve a llegar a Esri', async () => {
    const { deps } = dependencias(() => ({ status: 200, json: { error: { code: 400 } } }));
    const fuente = crearFuenteTiles(deps);
    await expect(fuente.tieneImagen(ZONA)).rejects.toThrow('inválido');
    await expect(fuente.tieneImagen(ZONA)).rejects.toThrow('inválido');
    expect(deps.bajar).toHaveBeenCalledTimes(2);
  });

  test('pasada la pausa se vuelve a intentar', async () => {
    vi.useFakeTimers();
    const { deps } = dependencias(() => tilemap([1, 1]));
    deps.bajar.mockImplementationOnce(sinRespuesta);
    const fuente = crearFuenteTiles(deps);
    const primero = expect(fuente.tieneImagen(ZONA)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(ESPERA_MS);
    await primero;
    await expect(fuente.tieneImagen(ZONA)).rejects.toThrow('no responde');
    await vi.advanceTimersByTimeAsync(PAUSA_MS);
    await expect(fuente.tieneImagen(ZONA)).resolves.toBe(true);
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

  test('un tilemap con error o sin datos rechaza y no queda en la caché', async () => {
    let roto = true;
    const conError = { status: 200, json: { error: { code: 400 } } };
    const { deps } = dependencias(() => (roto ? conError : tilemap([1, 1])));
    const fuente = crearFuenteTiles(deps);
    await expect(fuente.tieneImagen(ZONA)).rejects.toThrow('inválido');
    roto = false;
    await expect(fuente.tieneImagen(ZONA)).resolves.toBe(true);
  });
});
