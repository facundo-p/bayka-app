import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { PG_ERROR } from '../../lib/postgresErrorCodes';
import { listarPuntosGps } from '../mapaQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

const FILA_CON_ESPECIE = {
  latitude: -27.1,
  longitude: -55.2,
  species_id: 'sp-1',
  species: { codigo: 'QB', nombre: 'Quebracho' },
};

const FILA_SIN_ESPECIE = {
  latitude: -27.3,
  longitude: -55.4,
  species_id: null,
  species: null,
};

describe('listarPuntosGps', () => {
  test('lee acotando por plantación, filtrando lat/lng no nulos y paginando', async () => {
    const consultas = capturarConsultas(() => ({ data: [FILA_CON_ESPECIE] }));

    await listarPuntosGps('plant-1');

    const deArboles = consultas.filter((consulta) => consulta.tabla === 'trees');
    // Mock con < 1000 filas: una sola página (range 0–999) y corta.
    expect(deArboles).toHaveLength(1);
    expect(deArboles[0].rango).toEqual({ desde: 0, hasta: 999 });
    expect(deArboles[0].limite).toBeUndefined();
    expect(deArboles[0].filtros).toContainEqual({
      metodo: 'eq',
      columna: 'groups.plantation_id',
      valor: 'plant-1',
    });
    expect(deArboles[0].filtros).toContainEqual({
      metodo: 'not',
      columna: 'latitude',
      operador: 'is',
      valor: null,
    });
    expect(deArboles[0].filtros).toContainEqual({
      metodo: 'not',
      columna: 'longitude',
      operador: 'is',
      valor: null,
    });
  });

  test('mapea filas a puntos y usa N/N cuando no hay especie', async () => {
    capturarConsultas(() => ({ data: [FILA_CON_ESPECIE, FILA_SIN_ESPECIE] }));

    expect(await listarPuntosGps('plant-1')).toEqual([
      { lat: -27.1, lng: -55.2, codigo: 'QB', nombre: 'Quebracho' },
      { lat: -27.3, lng: -55.4, codigo: 'NN', nombre: 'Sin identificar' },
    ]);
  });

  test('devuelve [] si latitude/longitude no existen (migración 023 sin aplicar)', async () => {
    capturarConsultas((consulta: ConsultaCapturada): RespuestaMock => {
      if (consulta.tabla === 'trees') {
        return {
          error: { message: 'column trees.latitude does not exist', code: PG_ERROR.UNDEFINED_COLUMN },
        };
      }
      return { data: [] };
    });

    expect(await listarPuntosGps('plant-1')).toEqual([]);
  });
});
