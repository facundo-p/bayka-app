import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import { ErrorDeEdicion } from '../edicionDePlantacion';
import { FotoCambiadaError, quitarFotoDeArbol } from '../fotoDeArbol';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

const QUITADA = { success: true, quitadas: 1, rechazados: [], conservados: { arboles: [] } };

describe('quitarFotoDeArbol', () => {
  test('manda el árbol con la foto que se veía como base', async () => {
    const consultas = capturarConsultas(() => ({ data: QUITADA }));

    await expect(quitarFotoDeArbol('t1', 'p/t1.jpg')).resolves.toBeUndefined();
    expect(consultas).toEqual([
      expect.objectContaining({
        tabla: 'quitar_fotos_arboles',
        operacion: 'rpc',
        payload: { p_arboles: ['t1'], p_bases: { t1: 'p/t1.jpg' } },
      }),
    ]);
  });

  test('si alguien ya la había quitado no es error', async () => {
    capturarConsultas(() => ({ data: { ...QUITADA, quitadas: 0 } }));
    await expect(quitarFotoDeArbol('t1', 'p/t1.jpg')).resolves.toBeUndefined();
  });

  test('si la foto cambió en el server lanza el conflicto con la vigente', async () => {
    capturarConsultas(() => ({
      data: {
        ...QUITADA,
        quitadas: 0,
        conservados: { arboles: [{ id: 't1', foto_url: 'p/t1-v2.jpg' }] },
      },
    }));

    const error = await quitarFotoDeArbol('t1', 'p/t1.jpg').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FotoCambiadaError);
    expect((error as FotoCambiadaError).vigente).toBe('p/t1-v2.jpg');
    expect((error as Error).message).toMatch(/cambió la foto/);
  });

  test('rechazado por la plantación da su mensaje', async () => {
    capturarConsultas(() => ({ data: { ...QUITADA, quitadas: 0, rechazados: ['t1'] } }));

    const error = await quitarFotoDeArbol('t1', 'p/t1.jpg').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDeEdicion);
    expect(error).not.toBeInstanceOf(FotoCambiadaError);
    expect((error as Error).message).toMatch(/ya no admite cambios/);
  });

  test('success false da el mensaje genérico', async () => {
    capturarConsultas(() => ({ data: { success: false, error: 'boom' } }));
    await expect(quitarFotoDeArbol('t1', 'p/t1.jpg')).rejects.toThrow(
      /No se pudo eliminar la foto/,
    );
  });

  test('un error de red se propaga', async () => {
    capturarConsultas(() => ({ error: { message: 'Failed to fetch' } }));
    await expect(quitarFotoDeArbol('t1', 'p/t1.jpg')).rejects.toThrow('Failed to fetch');
  });
});
