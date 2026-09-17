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

describe('borrarFotosLocales (#484)', () => {
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
