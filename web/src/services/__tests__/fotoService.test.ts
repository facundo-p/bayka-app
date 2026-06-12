import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import { obtenerUrlFoto, tieneFotoSubida } from '../fotoService';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

const PATH_FOTO = 'plantations/p1/trees/tree-1.jpg';
const URL_COMPLETA = `https://abc.supabase.co/storage/v1/object/public/tree-photos/${PATH_FOTO}`;

describe('tieneFotoSubida', () => {
  test('false para vacía, null o archivos locales de mobile', () => {
    expect(tieneFotoSubida(null)).toBe(false);
    expect(tieneFotoSubida('')).toBe(false);
    expect(tieneFotoSubida('file:///data/foto.jpg')).toBe(false);
    expect(tieneFotoSubida('content://media/foto.jpg')).toBe(false);
  });

  test('true para paths y URLs del bucket', () => {
    expect(tieneFotoSubida(PATH_FOTO)).toBe(true);
    expect(tieneFotoSubida(URL_COMPLETA)).toBe(true);
  });
});

describe('obtenerUrlFoto', () => {
  test('devuelve null sin firmar nada para fotos locales o vacías', async () => {
    expect(await obtenerUrlFoto('file:///data/foto.jpg')).toBeNull();
    expect(await obtenerUrlFoto('content://media/foto.jpg')).toBeNull();
    expect(await obtenerUrlFoto(null)).toBeNull();
    expect(estadoMock.firmas).toHaveLength(0);
  });

  test('firma un path directo del bucket por una hora', async () => {
    const url = await obtenerUrlFoto(PATH_FOTO);

    expect(estadoMock.firmas).toEqual([
      { bucket: 'tree-photos', path: PATH_FOTO, segundos: 3600 },
    ]);
    expect(url).toBe(`https://firmada.test/${PATH_FOTO}`);
  });

  test('de una URL completa extrae el path interno del bucket', async () => {
    await obtenerUrlFoto(URL_COMPLETA);
    expect(estadoMock.firmas[0].path).toBe(PATH_FOTO);
  });

  test('descarta el query string de la URL al extraer el path', async () => {
    await obtenerUrlFoto(`${URL_COMPLETA}?token=abc`);
    expect(estadoMock.firmas[0].path).toBe(PATH_FOTO);
  });

  test('propaga el error de Storage', async () => {
    estadoMock.errorFirma = { message: 'objeto inexistente' };
    await expect(obtenerUrlFoto(PATH_FOTO)).rejects.toThrow('objeto inexistente');
  });
});
