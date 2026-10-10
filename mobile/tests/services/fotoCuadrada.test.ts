// Fotos 1:1 (#831): todo lo que se guarda sale cuadrado de 1200, y la galería no ofrece el recorte nativo.

const mockCopy = jest.fn();

jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///data/files' },
  Directory: jest.fn().mockImplementation((padre: string, nombre: string) => ({
    uri: `${padre}/${nombre}/`,
    exists: true,
    create: jest.fn(),
  })),
  File: jest.fn().mockImplementation((padreOUri: { uri: string } | string, nombre?: string) => ({
    uri: typeof padreOUri === 'string' ? padreOUri : `${padreOUri.uri}${nombre}`,
    copy: mockCopy,
  })),
}));
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'file:///cache/manipulada.jpg' }),
  SaveFormat: { JPEG: 'jpeg' },
}));

import { manipulateAsync } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { cropResizeAndSave, launchGalleryRaw } from '../../src/services/PhotoService';

const mockedManipulate = manipulateAsync as jest.Mock;
const RESIZE_CUADRADO = { resize: { width: 1200, height: 1200 } };

beforeEach(() => jest.clearAllMocks());

describe('cropResizeAndSave', () => {
  const RECORTE = { originX: 10, originY: 20, width: 800, height: 800 };

  it('recorta el cuadrado recibido y lo lleva a 1200×1200', async () => {
    await cropResizeAndSave('file:///raw.jpg', RECORTE);
    expect(mockedManipulate).toHaveBeenCalledWith(
      'file:///raw.jpg',
      [{ crop: RECORTE }, RESIZE_CUADRADO],
      expect.objectContaining({ format: 'jpeg' }),
    );
  });

  it('una foto chica también sale de 1200', async () => {
    await cropResizeAndSave('file:///raw.jpg', { originX: 0, originY: 0, width: 480, height: 480 });
    expect(mockedManipulate.mock.calls[0][1][1]).toEqual(RESIZE_CUADRADO);
  });

  it('copia el resultado a la carpeta permanente de fotos', async () => {
    const uri = await cropResizeAndSave('file:///raw.jpg', RECORTE);
    expect(uri).toMatch(/^file:\/\/\/data\/files\/photos\/photo_\d+\.jpg$/);
    expect(mockCopy).toHaveBeenCalledTimes(1);
  });

  it('un recorte vacío falla con un error claro sin llamar al manipulador', async () => {
    await expect(cropResizeAndSave('file:///raw.jpg', { originX: 0, originY: 0, width: 0, height: 0 }))
      .rejects.toThrow('recorte vacío');
    expect(mockedManipulate).not.toHaveBeenCalled();
    expect(mockCopy).not.toHaveBeenCalled();
  });
});

describe('launchGalleryRaw', () => {
  it('abre la galería solo con imágenes y sin el recorte nativo', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///galeria.jpg', width: 1000, height: 800 }],
    });
    await expect(launchGalleryRaw()).resolves.toEqual({ uri: 'file:///galeria.jpg', width: 1000, height: 800 });
    const opciones = (ImagePicker.launchImageLibraryAsync as jest.Mock).mock.calls[0][0];
    expect(opciones.mediaTypes).toEqual(['images']);
    expect(opciones.allowsEditing).toBeUndefined();
  });

  it('sin permiso no abre la galería', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    await expect(launchGalleryRaw()).resolves.toBeNull();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });
});
