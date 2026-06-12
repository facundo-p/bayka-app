import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { agregarEspecie, moverEspecie, quitarEspecie } from '../plantationSpeciesRepository';

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

describe('moverEspecie', () => {
  test('intercambia los orden_visual de la especie y su vecina (dos updates)', async () => {
    const consultas = capturarConsultas(() => ({ data: null }));
    await moverEspecie(
      'plant-1',
      { speciesId: 'sp-1', ordenVisual: 2 },
      { speciesId: 'sp-2', ordenVisual: 3 },
    );

    expect(consultas).toHaveLength(2);
    expect(consultas[0].operacion).toBe('update');
    expect(consultas[0].payload).toEqual({ orden_visual: 3 });
    expect(consultas[0].filtros).toEqual([
      { metodo: 'eq', columna: 'plantation_id', valor: 'plant-1' },
      { metodo: 'eq', columna: 'species_id', valor: 'sp-1' },
    ]);
    expect(consultas[1].payload).toEqual({ orden_visual: 2 });
    expect(consultas[1].filtros).toEqual([
      { metodo: 'eq', columna: 'plantation_id', valor: 'plant-1' },
      { metodo: 'eq', columna: 'species_id', valor: 'sp-2' },
    ]);
  });

  test('si falla el primer update no ejecuta el segundo y propaga', async () => {
    const consultas = capturarConsultas(() => ({ error: { message: 'falló el update' } }));
    await expect(
      moverEspecie(
        'plant-1',
        { speciesId: 'sp-1', ordenVisual: 0 },
        { speciesId: 'sp-2', ordenVisual: 1 },
      ),
    ).rejects.toThrow('falló el update');
    expect(consultas).toHaveLength(1);
  });
});
