import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { MENSAJE_ERROR_ESPECIES, aplicarCambiosEspecies } from '../plantationSpeciesRepository';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

/** Captura todas las consultas y delega la respuesta en `responder`. */
function capturarConsultas(responder: () => RespuestaMock): ConsultaCapturada[] {
  const consultas: ConsultaCapturada[] = [];
  estadoMock.resolverConsulta = (consulta) => {
    consultas.push(consulta);
    return responder();
  };
  return consultas;
}

describe('aplicarCambiosEspecies', () => {
  test('manda solo altas y bajas al RPC, en un solo request', async () => {
    const consultas = capturarConsultas(() => ({ data: { success: true, rechazadas: [] } }));
    await aplicarCambiosEspecies('plant-1', { altas: ['sp-1'], bajas: ['sp-2'] });

    expect(consultas).toHaveLength(1);
    expect(consultas[0].operacion).toBe('rpc');
    expect(consultas[0].tabla).toBe('aplicar_cambios_especies');
    expect(consultas[0].payload).toEqual({
      p_plantacion: 'plant-1',
      p_altas: ['sp-1'],
      p_bajas: ['sp-2'],
    });
  });

  test('traduce el rechazo de la plantación', async () => {
    capturarConsultas(() => ({ data: { success: false, error: 'PLANTACION_ARCHIVADA' } }));
    await expect(aplicarCambiosEspecies('plant-1', { altas: [], bajas: [] })).rejects.toThrow(
      'La plantación está archivada: no admite cambios.',
    );
  });

  test('una baja rechazada por árboles se informa aunque el resto se haya aplicado', async () => {
    capturarConsultas(() => ({
      data: { success: true, rechazadas: [{ species_id: 'sp-2', error: 'ESPECIE_CON_ARBOLES' }] },
    }));
    await expect(
      aplicarCambiosEspecies('plant-1', { altas: ['sp-1'], bajas: ['sp-2'] }),
    ).rejects.toThrow('La especie ya tiene árboles registrados: no se puede quitar.');
  });

  test('un rechazo desconocido cae al mensaje genérico', async () => {
    capturarConsultas(() => ({ data: { success: false, error: 'LO_QUE_SEA' } }));
    await expect(aplicarCambiosEspecies('plant-1', { altas: [], bajas: [] })).rejects.toThrow(
      MENSAJE_ERROR_ESPECIES,
    );
  });

  test('propaga el error de Supabase', async () => {
    capturarConsultas(() => ({ error: { message: 'falló la red' } }));
    await expect(aplicarCambiosEspecies('plant-1', { altas: [], bajas: [] })).rejects.toThrow(
      'falló la red',
    );
  });
});
