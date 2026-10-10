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
  expect(fetchFalso).toHaveBeenCalledWith('https://firmada.test/p/a.jpg');
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
