import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import { ErrorDeEdicion } from '../edicionDePlantacion';
import { cambiarEspecieDeArbol, ConflictoDeEspecieError } from '../especieDeArbol';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

describe('cambiarEspecieDeArbol', () => {
  test('manda árbol, especie nueva y base, y devuelve el SubID nuevo', async () => {
    const consultas = capturarConsultas(() => ({ data: { success: true, sub_id: 'P1L1CEI3' } }));

    await expect(cambiarEspecieDeArbol('t1', 'sp-2', 'sp-1')).resolves.toBe('P1L1CEI3');
    expect(consultas).toEqual([
      expect.objectContaining({
        tabla: 'cambiar_especie_arbol',
        operacion: 'rpc',
        payload: { p_tree_id: 't1', p_species_id: 'sp-2', p_base: 'sp-1' },
      }),
    ]);
  });

  test('un N/N viaja con base null', async () => {
    const consultas = capturarConsultas(() => ({ data: { success: true, sub_id: 'X' } }));
    await cambiarEspecieDeArbol('t1', 'sp-2', null);
    expect(consultas[0].payload).toMatchObject({ p_base: null });
  });

  test('si la especie cambió en otro lado lanza el conflicto con lo que tiene el server', async () => {
    capturarConsultas(() => ({
      data: {
        success: false,
        error: 'CONFLICTO_EDICION',
        species_id: 'sp-3',
        codigo: 'TAL',
        nombre: 'Tala',
        sub_id: 'P1L1TAL3',
      },
    }));

    const error = await cambiarEspecieDeArbol('t1', 'sp-2', 'sp-1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictoDeEspecieError);
    expect((error as ConflictoDeEspecieError).vigente).toEqual({
      especieId: 'sp-3',
      especieCodigo: 'TAL',
      especieNombre: 'Tala',
      subId: 'P1L1TAL3',
    });
    expect((error as Error).message).toMatch(/ahora es Tala/);
  });

  test.each([
    ['PLANTACION_ARCHIVADA', /archivada/],
    ['PLANTACION_FINALIZADA', /finalizada/],
    ['NOT_AUTHORIZED', /permisos/],
    ['ESPECIE_NO_HABILITADA', /ya no está habilitada/],
    ['OTRO', /No se pudo cambiar la especie/],
  ])('rechazo %s da un mensaje propio', async (codigo, mensaje) => {
    capturarConsultas(() => ({ data: { success: false, error: codigo } }));
    const error = await cambiarEspecieDeArbol('t1', 'sp-2', 'sp-1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDeEdicion);
    expect(error).not.toBeInstanceOf(ConflictoDeEspecieError);
    expect((error as Error).message).toMatch(mensaje);
  });

  test('un error de red se propaga', async () => {
    capturarConsultas(() => ({ error: { message: 'Failed to fetch' } }));
    await expect(cambiarEspecieDeArbol('t1', 'sp-2', 'sp-1')).rejects.toThrow('Failed to fetch');
  });
});
