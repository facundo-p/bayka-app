import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import { cargarFotos } from '../fotos';
import { reducirImagen } from '../reducirImagen';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

// jsdom no tiene canvas: la reducción se prueba en el navegador.
vi.mock('../reducirImagen', () => ({ reducirImagen: vi.fn() }));

const reducir = vi.mocked(reducirImagen);
const fetchFalso = vi.fn<typeof fetch>();

beforeEach(() => {
  resetEstadoMock();
  reducir.mockReset().mockImplementation(async () => 'data:image/jpeg;base64,REDUCIDA');
  fetchFalso.mockReset().mockImplementation(async () => new Response(new Blob(['jpg'])));
  vi.stubGlobal('fetch', fetchFalso);
});

afterEach(() => vi.unstubAllGlobals());

const LISTA = { estado: 'lista', src: 'data:image/jpeg;base64,REDUCIDA' };
const SIN_FOTO = { estado: 'sin-foto' };
const NO_DISPONIBLE = { estado: 'no-disponible' };

test('firma solo las subidas, en una llamada, y reduce cada una', async () => {
  const fotos = await cargarFotos(['p/a.jpg', null, 'file:///local.jpg', 'p/b.jpg']);

  expect(fotos).toEqual([LISTA, SIN_FOTO, SIN_FOTO, LISTA]);
  expect(estadoMock.firmas.map((firma) => firma.path)).toEqual(['p/a.jpg', 'p/b.jpg']);
  expect(fetchFalso.mock.calls[0][0]).toBe('https://firmada.test/p/a.jpg');
  expect(reducir).toHaveBeenCalledWith(expect.anything(), { ancho: 480, alto: 480, calidad: 0.75 });
});

test('una foto sin firma (sin permiso o inexistente) queda no disponible', async () => {
  estadoMock.pathsSinFirma = ['p/ajena.jpg'];
  expect(await cargarFotos(['p/ajena.jpg', 'p/b.jpg'])).toEqual([NO_DISPONIBLE, LISTA]);
  expect(fetchFalso).toHaveBeenCalledTimes(1);
});

test('un fetch que falla o responde error no corta las demás', async () => {
  fetchFalso
    .mockRejectedValueOnce(new TypeError('CORS'))
    .mockResolvedValueOnce(new Response('', { status: 403 }));
  const fotos = await cargarFotos(['p/a.jpg', 'p/b.jpg', 'p/c.jpg']);
  expect(fotos).toEqual([NO_DISPONIBLE, NO_DISPONIBLE, LISTA]);
});

test('una imagen que no se puede decodificar queda no disponible', async () => {
  reducir.mockRejectedValueOnce(new Error('No se pudo decodificar la imagen'));
  expect(await cargarFotos(['p/a.jpg'])).toEqual([NO_DISPONIBLE]);
});

test('si falla la firma entera, todas las subidas quedan no disponibles', async () => {
  estadoMock.errorFirma = { message: 'sin red' };
  expect(await cargarFotos(['p/a.jpg', null])).toEqual([NO_DISPONIBLE, SIN_FOTO]);
});

test('avisa cada foto terminada, bajada o fallida, sobre las que hay que bajar', async () => {
  fetchFalso.mockRejectedValueOnce(new TypeError('CORS'));
  const alProgresar = vi.fn();
  await cargarFotos(['p/a.jpg', null, 'p/b.jpg', 'p/c.jpg'], { alProgresar });
  expect(alProgresar.mock.calls).toEqual([
    [0, 3],
    [1, 3],
    [2, 3],
    [3, 3],
  ]);
});

test('si falla la firma entera, el progreso igual llega al total', async () => {
  estadoMock.errorFirma = { message: 'sin red' };
  const alProgresar = vi.fn();
  await cargarFotos(['p/a.jpg', 'p/b.jpg'], { alProgresar });
  expect(alProgresar).toHaveBeenLastCalledWith(2, 2);
});

test('reduce a la medida pedida', async () => {
  const medida = { ancho: 360, alto: 360, calidad: 0.7 };
  await cargarFotos(['p/a.jpg'], { medida });
  expect(reducir).toHaveBeenCalledWith(expect.anything(), medida);
});

describe('cancelar', () => {
  test('con la señal ya abortada no firma ni baja nada', async () => {
    const control = new AbortController();
    control.abort();
    await expect(cargarFotos(['p/a.jpg'], { senal: control.signal })).rejects.toThrow();
    expect(estadoMock.firmas).toEqual([]);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  test('corta las descargas en curso, no lanza más y rechaza en vez de dejarlas no disponibles', async () => {
    const control = new AbortController();
    // Cada fetch queda colgado hasta que la señal lo corta, como el de verdad.
    fetchFalso.mockImplementation(
      (_url, init) =>
        new Promise((_, rechazar) =>
          init?.signal?.addEventListener('abort', () => rechazar(init.signal?.reason)),
        ),
    );
    const urls = Array.from({ length: 20 }, (_, indice) => `p/${indice}.jpg`);
    const carga = cargarFotos(urls, { senal: control.signal });
    await vi.waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(10));
    control.abort();

    await expect(carga).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchFalso).toHaveBeenCalledTimes(10);
    expect(reducir).not.toHaveBeenCalled();
  });

  test('cada fetch lleva la señal', async () => {
    const control = new AbortController();
    await cargarFotos(['p/a.jpg'], { senal: control.signal });
    expect(fetchFalso.mock.calls[0][1]).toEqual({ signal: control.signal });
  });
});
