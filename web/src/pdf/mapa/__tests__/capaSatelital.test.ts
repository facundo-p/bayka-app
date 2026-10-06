import { liberarCanvas } from '../../canvas';
import { capaSatelital, rectanguloAlPixel } from '../capaSatelital';
import type { FuenteTiles } from '../cargaTiles';
import { dibujarMapa, type CapaFondo } from '../dibujarMapa';
import { encuadrar, type Encuadre } from '../proyeccion';
import { TOPE_TILES, tilesDelZoom, type TileXYZ, type ZonaTiles } from '../tiles';

type Llamada = { nombre: string; args: unknown[] };

// jsdom no tiene canvas: un contexto que anota lo que se le pide.
const llamadas: Llamada[] = [];
/** Método del contexto que lanza, para simular un canvas que falla a mitad del dibujo. */
let metodoQueFalla: string | null = null;
vi.mock('../../canvas', () => ({
  crearCanvas: () => ({}),
  contexto2d: () =>
    new Proxy(
      {},
      {
        get: (_objetivo, nombre: string) => {
          if (nombre === 'measureText') return () => ({ width: 10 });
          return (...args: unknown[]) => {
            if (nombre === metodoQueFalla) throw new Error(nombre);
            llamadas.push({ nombre, args });
          };
        },
        set: () => true,
      },
    ),
  exportarYLiberar: (_canvas: unknown, tipo: string) => `data:${tipo};base64,M`,
  liberarCanvas: vi.fn(),
}));

const dibujos = () => llamadas.filter(({ nombre }) => nombre === 'drawImage');

const PUNTO = { lat: -27.36012, lng: -55.89744 };
const ENCUADRE: Encuadre = encuadrar([PUNTO], 128, 128, { margen: 10, minimoMetros: 60 });
const CONTENIDO = { puntos: [{ ...PUNTO, color: '#000' }], ancho: 128, alto: 128 };

const imagen = () => ({ close: vi.fn() }) as unknown as ImageBitmap;

/** Fuente con imagen desde `hastaZoom` para abajo; con `falla`, la descarga de tiles falla. */
function fuente({ hastaZoom = 19, falla = false } = {}) {
  return {
    tieneImagen: vi.fn(async ({ z }: ZonaTiles) => z <= hastaZoom),
    cargar: vi.fn(async (tiles: readonly TileXYZ[]) => {
      if (falla) throw new Error('red');
      return tiles.map(imagen);
    }),
  } satisfies FuenteTiles;
}

const zoomsPreguntados = (f: ReturnType<typeof fuente>) =>
  f.tieneImagen.mock.calls.map(([zona]) => zona.z);

beforeEach(() => {
  llamadas.length = 0;
  metodoQueFalla = null;
  vi.mocked(liberarCanvas).mockClear();
});

/** Rellenos del canvas entero: el fondo liso. */
const fondosLisos = (desde = 0) =>
  llamadas
    .slice(desde)
    .filter(({ nombre, args }) => nombre === 'fillRect' && args.join() === '0,0,128,128');

describe('capaSatelital', () => {
  test('con los tiles bajados, devuelve con qué pintarlos', async () => {
    const f = fuente();
    expect(await capaSatelital(TOPE_TILES.ficha, f)(ENCUADRE)).toEqual({
      pintar: expect.any(Function),
      liberar: expect.any(Function),
    });
    expect(f.cargar.mock.calls[0][0].length).toBeLessThanOrEqual(16);
  });

  test('si falla cualquier tile, no hay fondo', async () => {
    expect(await capaSatelital(TOPE_TILES.ficha, fuente({ falla: true }))(ENCUADRE)).toBeNull();
  });

  test('si no se puede saber qué zona tiene imagen, no hay fondo', async () => {
    const f = fuente();
    f.tieneImagen.mockRejectedValueOnce(new Error('red'));
    expect(await capaSatelital(TOPE_TILES.ficha, f)(ENCUADRE)).toBeNull();
    expect(f.cargar).not.toHaveBeenCalled();
  });

  test('sin imagen al zoom elegido, baja hasta tres zooms y usa el primero con imagen', async () => {
    const f = fuente({ hastaZoom: 17 });
    expect(await capaSatelital(TOPE_TILES.ficha, f)(ENCUADRE)).not.toBeNull();
    expect(zoomsPreguntados(f)).toEqual([19, 18, 17]);
    expect(f.cargar.mock.calls[0][0][0].z).toBe(17);
  });

  test('si tampoco hay imagen tres zooms más abajo, no hay fondo', async () => {
    const f = fuente({ hastaZoom: 15 });
    expect(await capaSatelital(TOPE_TILES.ficha, f)(ENCUADRE)).toBeNull();
    expect(zoomsPreguntados(f)).toEqual([19, 18, 17, 16]);
    expect(f.cargar).not.toHaveBeenCalled();
  });
});

test('los bordes del tile se llevan al px del canvas hacia afuera', () => {
  const tile = { z: 1, x: 0, y: 0, destino: { x: 10.1, y: -3.3 }, lado: 20.05 };
  // Con 2,5 px por pt: x de 25,25 a 75,375 px → 25 a 76; y de -8,25 a 41,875 → -9 a 42.
  const { x, y, ancho, alto } = rectanguloAlPixel(tile, 2.5);
  expect([x, y, ancho, alto].map((valor) => valor * 2.5)).toEqual([
    25,
    -9,
    expect.closeTo(51),
    expect.closeTo(51),
  ]);
});

describe('dibujarMapa con el satélite', () => {
  test('con el fondo pintado, el mapa sale en JPEG y marcado con satélite', async () => {
    const mapa = await dibujarMapa({ ...CONTENIDO, fondo: capaSatelital(16, fuente()) });
    expect(mapa).toEqual({ src: 'data:image/jpeg;base64,M', conFondo: true });
  });

  test('cada tile va en su rectángulo, llevado al px del canvas', async () => {
    const f = fuente();
    await dibujarMapa({ ...CONTENIDO, fondo: capaSatelital(16, f), escalaRender: 2.5 });
    const imagenes = (await f.cargar.mock.results[0].value) as ImageBitmap[];
    const tiles = tilesDelZoom(ENCUADRE, f.cargar.mock.calls[0][0][0].z);
    expect(dibujos()).toHaveLength(tiles.length);
    tiles.forEach((tile, indice) => {
      const { x, y, ancho, alto } = rectanguloAlPixel(tile, 2.5);
      expect(dibujos()[indice].args).toEqual([imagenes[indice], x, y, ancho, alto]);
    });
  });

  test('después de pintar, libera las imágenes de los tiles', async () => {
    const f = fuente();
    await dibujarMapa({ ...CONTENIDO, fondo: capaSatelital(16, f) });
    const imagenes = (await f.cargar.mock.results[0].value) as { close: () => void }[];
    imagenes.forEach((imagen) => expect(imagen.close).toHaveBeenCalled());
  });

  test('si falla un tile, el mapa sale liso, en PNG y sin satélite', async () => {
    const fondo = capaSatelital(16, fuente({ falla: true }));
    const mapa = await dibujarMapa({ ...CONTENIDO, fondo });
    expect(mapa).toEqual({ src: 'data:image/png;base64,M', conFondo: false });
    expect(dibujos()).toHaveLength(0);
  });

  test('si pintar el fondo falla, el mapa sale liso, sin satélite, y libera la imagen', async () => {
    const liberar = vi.fn();
    let tras = -1;
    const pintar = () => {
      tras = llamadas.length;
      throw new Error('drawImage');
    };
    const fondo: CapaFondo = async () => ({ pintar, liberar });
    const mapa = await dibujarMapa({ ...CONTENIDO, fondo });
    expect(mapa).toEqual({ src: 'data:image/png;base64,M', conFondo: false });
    expect(liberar).toHaveBeenCalledTimes(1);
    // Lo que alcanzó a pintar queda tapado por el fondo liso otra vez.
    expect(fondosLisos(tras)).toHaveLength(1);
  });

  test('si falla lo que va encima, igual libera la imagen del fondo y el canvas', async () => {
    const liberar = vi.fn();
    const fondo: CapaFondo = async () => ({ pintar: () => {}, liberar });
    metodoQueFalla = 'arc';
    await expect(dibujarMapa({ ...CONTENIDO, fondo })).rejects.toThrow('arc');
    expect(liberar).toHaveBeenCalledTimes(1);
    expect(liberarCanvas).toHaveBeenCalledTimes(1);
  });
});
