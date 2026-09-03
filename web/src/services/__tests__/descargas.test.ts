import { aSlug, nombreArchivoDescarga, descargarBlob, descargarTexto } from '../descargas';

test('aSlug pasa a minúsculas, saca acentos y símbolos, y no deja guiones en las puntas', () => {
  expect(aSlug('Finca "El Álamo" Ñuñoa')).toBe('finca-el-alamo-nunoa');
  expect(aSlug('  --Espacios--  ')).toBe('espacios');
});

test('aSlug de string vacío da string vacío', () => {
  expect(aSlug('')).toBe('');
});

test('nombreArchivoDescarga arma <prefijo>-<lugar>-<periodo>.<extension>', () => {
  expect(nombreArchivoDescarga('arboles', 'Mendoza', '2025-2026', 'csv')).toBe(
    'arboles-mendoza-2025-2026.csv',
  );
});

test('nombreArchivoDescarga omite partes vacías tras el slug', () => {
  expect(nombreArchivoDescarga('arboles', '', '2025-2026', 'csv')).toBe(
    'arboles-2025-2026.csv',
  );
  expect(nombreArchivoDescarga('arboles', '', '', 'csv')).toBe('arboles-.csv');
});

// jsdom no implementa URL.createObjectURL/revokeObjectURL: se stubean antes de spiarlas.
beforeEach(() => {
  URL.createObjectURL ??= vi.fn();
  URL.revokeObjectURL ??= vi.fn();
});

describe('descargarBlob', () => {
  test('crea un enlace temporal, dispara el click y libera la URL del objeto', () => {
    const urlObjeto = 'blob:mock-url';
    const crearUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue(urlObjeto);
    const revocarUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const blob = new Blob(['contenido'], { type: 'text/plain' });
    descargarBlob(blob, 'archivo.txt');

    expect(crearUrl).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revocarUrl).toHaveBeenCalledWith(urlObjeto);
    expect(document.querySelector('a[download="archivo.txt"]')).toBeNull();

    crearUrl.mockRestore();
    revocarUrl.mockRestore();
    clickSpy.mockRestore();
  });
});

describe('descargarTexto', () => {
  test('envuelve el contenido en un Blob con el tipo MIME dado y descarga con ese nombre', () => {
    const crearUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    descargarTexto('a,b,c', 'datos.csv', 'text/csv');

    const blobPasado = crearUrl.mock.calls[0][0] as Blob;
    expect(blobPasado.type).toBe('text/csv');
    expect(blobPasado.size).toBe('a,b,c'.length);

    vi.restoreAllMocks();
  });
});
