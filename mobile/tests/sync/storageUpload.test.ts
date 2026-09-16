const mockUpload = jest.fn();
jest.mock('../../src/supabase/client', () => ({
  supabase: { storage: { from: () => ({ upload: mockUpload }) } },
  isSupabaseConfigured: true,
}));

const mockArrayBuffer = jest.fn();
jest.mock('expo-file-system', () => ({
  File: class {
    arrayBuffer = mockArrayBuffer;
  },
}));

import { uploadPhotoToStorage } from '../../src/services/sync/storageUpload';

const UNA_FOTO = new ArrayBuffer(2 * 1024 * 1024);

describe('uploadPhotoToStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockArrayBuffer.mockResolvedValue(UNA_FOTO);
  });

  // El archivo ya se materializa entero para subirlo: exponer el tamaño no cuesta
  // una lectura de más, y es lo que alimenta el indicador de velocidad (#450).
  it('devuelve los bytes subidos', async () => {
    mockUpload.mockResolvedValue({ error: null });

    await expect(uploadPhotoToStorage('file://foto.jpg', 'p/t.jpg')).resolves.toEqual({
      error: null,
      bytes: UNA_FOTO.byteLength,
    });
  });

  // Lo que no llegó al servidor no es velocidad de transferencia.
  it('una subida rechazada no informa bytes', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'Payload too large' } });

    const { error, bytes } = await uploadPhotoToStorage('file://foto.jpg', 'p/t.jpg');

    expect(error?.message).toBe('Payload too large');
    expect(bytes).toBe(0);
  });

  it('un archivo que no se puede leer tampoco informa bytes', async () => {
    mockArrayBuffer.mockRejectedValue(new Error('ENOENT'));

    const { error, bytes } = await uploadPhotoToStorage('file://no-existe.jpg', 'p/t.jpg');

    expect(error?.message).toBe('ENOENT');
    expect(bytes).toBe(0);
  });
});
