import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import {
  MENSAJE_ERROR_REEMPLAZO,
  agregarEspecie,
  quitarEspecie,
  reemplazarEspecies,
} from '../plantationSpeciesRepository';

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

describe('agregarEspecie', () => {
  test('inserta la especie con su orden visual', async () => {
    const consultas = capturarConsultas(() => ({ data: null }));
    await agregarEspecie('plant-1', 'sp-1', 5);

    expect(consultas[0].tabla).toBe('plantation_species');
    expect(consultas[0].operacion).toBe('insert');
    expect(consultas[0].payload).toEqual({
      plantation_id: 'plant-1',
      species_id: 'sp-1',
      orden_visual: 5,
    });
  });

  test('propaga el error de Supabase', async () => {
    capturarConsultas(() => ({ error: { message: 'sin permisos' } }));
    await expect(agregarEspecie('plant-1', 'sp-1', 0)).rejects.toThrow('sin permisos');
  });
});

describe('quitarEspecie', () => {
  test('borra la fila filtrando por plantación y especie', async () => {
    const consultas = capturarConsultas(() => ({ data: null }));
    await quitarEspecie('plant-1', 'sp-1');

    expect(consultas[0].tabla).toBe('plantation_species');
    expect(consultas[0].operacion).toBe('delete');
    expect(consultas[0].filtros).toEqual([
      { metodo: 'eq', columna: 'plantation_id', valor: 'plant-1' },
      { metodo: 'eq', columna: 'species_id', valor: 'sp-1' },
    ]);
  });

  test('propaga el error de Supabase', async () => {
    capturarConsultas(() => ({ error: { message: 'falló la red' } }));
    await expect(quitarEspecie('plant-1', 'sp-1')).rejects.toThrow('falló la red');
  });
});

describe('reemplazarEspecies', () => {
  test('manda la lista final entera al RPC, en un solo request', async () => {
    const consultas = capturarConsultas(() => ({ data: { success: true } }));
    await reemplazarEspecies('plant-1', [
      { speciesId: 'sp-1', ordenVisual: 0 },
      { speciesId: 'sp-2', ordenVisual: 1 },
    ]);

    expect(consultas).toHaveLength(1);
    expect(consultas[0].operacion).toBe('rpc');
    expect(consultas[0].tabla).toBe('reemplazar_especies_plantacion');
    expect(consultas[0].payload).toEqual({
      p_plantacion: 'plant-1',
      p_especies: [
        { species_id: 'sp-1', orden_visual: 0 },
        { species_id: 'sp-2', orden_visual: 1 },
      ],
    });
  });

  test('una lista vacía deja la plantación sin especies, también en un request', async () => {
    const consultas = capturarConsultas(() => ({ data: { success: true } }));
    await reemplazarEspecies('plant-1', []);

    expect(consultas).toHaveLength(1);
    expect(consultas[0].payload).toEqual({ p_plantacion: 'plant-1', p_especies: [] });
  });

  test('traduce el rechazo del RPC', async () => {
    capturarConsultas(() => ({ data: { success: false, error: 'PLANTACION_ARCHIVADA' } }));
    await expect(reemplazarEspecies('plant-1', [])).rejects.toThrow(
      'La plantación está archivada: no admite cambios.',
    );
  });

  test('un rechazo desconocido cae al mensaje genérico', async () => {
    capturarConsultas(() => ({ data: { success: false, error: 'LO_QUE_SEA' } }));
    await expect(reemplazarEspecies('plant-1', [])).rejects.toThrow(MENSAJE_ERROR_REEMPLAZO);
  });

  test('propaga el error de Supabase', async () => {
    capturarConsultas(() => ({ error: { message: 'falló la red' } }));
    await expect(reemplazarEspecies('plant-1', [])).rejects.toThrow('falló la red');
  });
});
