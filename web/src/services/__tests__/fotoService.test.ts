import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import {
  firmarFotos,
  obtenerUrlDescargaFoto,
  obtenerUrlFoto,
  tieneFotoSubida,
} from '../fotoService';

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

    expect(estadoMock.firmas).toEqual([{ bucket: 'tree-photos', path: PATH_FOTO, segundos: 3600 }]);
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

describe('obtenerUrlDescargaFoto', () => {
  test('firma pidiendo el nombre del archivo como descarga', async () => {
    await obtenerUrlDescargaFoto(PATH_FOTO, 'foto-finca-2026-a-1.jpg');
    expect(estadoMock.firmas).toEqual([
      {
        bucket: 'tree-photos',
        path: PATH_FOTO,
        segundos: 3600,
        download: 'foto-finca-2026-a-1.jpg',
      },
    ]);
  });

  test('sin foto subida devuelve null sin firmar', async () => {
    expect(await obtenerUrlDescargaFoto('file:///data/foto.jpg', 'x.jpg')).toBeNull();
    expect(estadoMock.firmas).toHaveLength(0);
  });
});

describe('firmarFotos', () => {
  test('firma todo en una llamada, en orden, extrayendo el path', async () => {
    const urls = await firmarFotos([PATH_FOTO, URL_COMPLETA]);
    expect(estadoMock.firmas).toEqual([
      { bucket: 'tree-photos', path: PATH_FOTO, segundos: 3600 },
      { bucket: 'tree-photos', path: PATH_FOTO, segundos: 3600 },
    ]);
    expect(urls).toEqual([
      `https://firmada.test/${PATH_FOTO}`,
      `https://firmada.test/${PATH_FOTO}`,
    ]);
  });

  test('una foto que Storage no firma queda en null sin afectar al resto', async () => {
    estadoMock.pathsSinFirma = ['plantations/p1/trees/ajena.jpg'];
    const urls = await firmarFotos(['plantations/p1/trees/ajena.jpg', PATH_FOTO]);
    expect(urls).toEqual([null, `https://firmada.test/${PATH_FOTO}`]);
  });

  test('si falla la llamada entera, todas quedan en null', async () => {
    estadoMock.errorFirma = { message: 'sin red' };
    expect(await firmarFotos([PATH_FOTO])).toEqual([null]);
  });

  test('sin fotos no llama a Storage', async () => {
    expect(await firmarFotos([])).toEqual([]);
    expect(estadoMock.firmas).toHaveLength(0);
  });
});
