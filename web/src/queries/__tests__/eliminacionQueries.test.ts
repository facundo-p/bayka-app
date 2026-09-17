import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import { MENSAJE_ERROR_PREVIEW, previsualizarEliminacion } from '../eliminacionQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

test('llama al RPC con el id y mapea la respuesta', async () => {
  const consultas = capturarConsultas(() => ({
    data: {
      success: true,
      parcelas: 2,
      grupos: 3,
      arboles: 40,
      arboles_con_foto: 5,
      tiene_datos: true,
      puede: false,
      motivo: 'REQUIERE_ARCHIVAR',
    },
  }));

  const preview = await previsualizarEliminacion('plant-1');

  expect(consultas[0]).toEqual(
    expect.objectContaining({
      tabla: 'previsualizar_eliminacion_plantacion',
      operacion: 'rpc',
      payload: { p_id: 'plant-1' },
    }),
  );
  expect(preview).toEqual({
    parcelas: 2,
    grupos: 3,
    arboles: 40,
    arbolesConFoto: 5,
    tieneDatos: true,
    motivo: 'REQUIERE_ARCHIVAR',
  });
});

test.each([
  ['sin permiso', { data: { success: false, error: 'NOT_AUTHORIZED' } }],
  ['error de red', { error: { message: 'fetch failed' } }],
])('%s → mensaje de error propio', async (_caso, respuesta) => {
  capturarConsultas(() => respuesta);
  await expect(previsualizarEliminacion('plant-1')).rejects.toThrow(MENSAJE_ERROR_PREVIEW);
});
