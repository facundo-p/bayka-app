const mockArchivos = new Map<string, { delete: jest.Mock }>();

jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///data/files' },
  Directory: jest.fn().mockImplementation((padre: string, nombre: string) => ({
    uri: `${padre}/${nombre}/`,
    exists: true,
    create: jest.fn(),
  })),
  File: jest.fn().mockImplementation((uri: string) => ({
    uri,
    get exists() { return mockArchivos.has(uri); },
    delete: () => mockArchivos.get(uri)!.delete(),
  })),
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-image-manipulator', () => ({}));

import { borrarFotosLocales } from '../../src/services/PhotoService';

const FOTO_A = 'file:///data/files/photos/photo_1.jpg';
const FOTO_B = 'file:///data/files/photos/photo_tree-2.jpg';

function archivo(uri: string, del: jest.Mock = jest.fn()) {
  mockArchivos.set(uri, { delete: del });
  return del;
}

describe('borrarFotosLocales (#484, #527)', () => {
  beforeEach(() => mockArchivos.clear());

  it('borra los archivos de la carpeta de fotos', () => {
    const borrarA = archivo(FOTO_A);
    const borrarB = archivo(FOTO_B);

    borrarFotosLocales([FOTO_A, FOTO_B]);

    expect(borrarA).toHaveBeenCalledTimes(1);
    expect(borrarB).toHaveBeenCalledTimes(1);
  });

  it('no toca paths de Storage, URIs remotas ni archivos fuera de la carpeta de fotos', () => {
    const ajenas = [
      'plantations/p-1/parcelas/pa-1/trees/t-1.jpg',
      'https://example.com/photo.jpg',
      'content://media/external/images/media/42',
      'file:///data/files/export.csv',
    ];
    const borrados = ajenas.map((uri) => archivo(uri));

    borrarFotosLocales(ajenas);

    borrados.forEach((borrar) => expect(borrar).not.toHaveBeenCalled());
  });

  // Empezar con la carpeta no alcanza: `..` sale de ella, también codificado (#527).
  it('no borra paths que salen de la carpeta de fotos o entran en subcarpetas', () => {
    const escapes = [
      'file:///data/files/photos/../SQLite/bayka.db',
      'file:///data/files/photos/..',
      'file:///data/files/photos/%2e%2e/SQLite/bayka.db',
      'file:///data/files/photos/%2E%2E%2FSQLite%2Fbayka.db',
      'file:///data/files/photos/..%5CSQLite%5Cbayka.db',
      'file:///data/files/photos/sub/photo_1.jpg',
      'file:///data/files/photos/',
      'file:///data/files/photos/%E0%A4%A.jpg',
    ];
    const borrados = escapes.map((uri) => archivo(uri));

    borrarFotosLocales(escapes);

    borrados.forEach((borrar) => expect(borrar).not.toHaveBeenCalled());
  });

  // El nombre puede traer puntos: lo que se rechaza es el segmento `..`, no el carácter.
  it('un nombre de archivo con puntos sigue siendo una foto propia', () => {
    const uri = 'file:///data/files/photos/..photo_1.v2.jpg';
    const borrar = archivo(uri);

    borrarFotosLocales([uri]);

    expect(borrar).toHaveBeenCalledTimes(1);
  });

  it('un archivo que ya no existe se saltea', () => {
    expect(() => borrarFotosLocales([FOTO_A])).not.toThrow();
  });

  // Best-effort: la plantación ya se borró; un archivo trabado no puede romper la operación.
  it('un fallo al borrar no corta el resto ni propaga', () => {
    archivo(FOTO_A, jest.fn(() => { throw new Error('EACCES'); }));
    const borrarB = archivo(FOTO_B);
    const errorOriginal = console.error;
    console.error = jest.fn();

    try {
      expect(() => borrarFotosLocales([FOTO_A, FOTO_B])).not.toThrow();
    } finally {
      console.error = errorOriginal;
    }
    expect(borrarB).toHaveBeenCalledTimes(1);
  });
});
