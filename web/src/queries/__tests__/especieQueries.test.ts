import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import {
  listarCatalogo,
  listarEspeciesConUso,
  listarEspeciesDePlantacion,
} from '../especieQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

const FILA_QUEBRACHO = {
  id: 'sp-1',
  codigo: 'QB',
  nombre: 'Quebracho',
  nombre_cientifico: 'Schinopsis balansae',
};

const FILA_ALGARROBO = {
  id: 'sp-2',
  codigo: 'AL',
  nombre: 'Algarrobo',
  nombre_cientifico: null,
};

function filaAsignada(fila: typeof FILA_QUEBRACHO | typeof FILA_ALGARROBO, orden: number) {
  return { species_id: fila.id, orden_visual: orden, species: fila };
}

describe('listarCatalogo', () => {
  test('consulta species ordenado por código y mapea a camelCase', async () => {
    const consultas = capturarConsultas(() => ({ data: [FILA_QUEBRACHO, FILA_ALGARROBO] }));
    const catalogo = await listarCatalogo();

    expect(consultas[0].tabla).toBe('species');
    expect(consultas[0].orden).toEqual({ columna: 'codigo', ascending: true });
    expect(catalogo).toEqual([
      { id: 'sp-1', codigo: 'QB', nombre: 'Quebracho', nombreCientifico: 'Schinopsis balansae' },
      { id: 'sp-2', codigo: 'AL', nombre: 'Algarrobo', nombreCientifico: null },
    ]);
  });

  test('propaga el error de Supabase', async () => {
    capturarConsultas(() => ({ error: { message: 'sin permisos' } }));
    await expect(listarCatalogo()).rejects.toThrow('sin permisos');
  });
});

describe('listarEspeciesDePlantacion', () => {
  test('filtra por plantación, ordena por orden_visual y mapea el embed', async () => {
    const consultas = capturarConsultas(() => ({
      data: [filaAsignada(FILA_ALGARROBO, 0), filaAsignada(FILA_QUEBRACHO, 1)],
    }));
    const especies = await listarEspeciesDePlantacion('plant-1');

    expect(consultas[0].tabla).toBe('plantation_species');
    expect(consultas[0].filtros).toEqual([
      { metodo: 'eq', columna: 'plantation_id', valor: 'plant-1' },
    ]);
    expect(consultas[0].orden).toEqual({ columna: 'orden_visual', ascending: true });
    expect(especies).toEqual([
      { id: 'sp-2', codigo: 'AL', nombre: 'Algarrobo', nombreCientifico: null, ordenVisual: 0 },
      {
        id: 'sp-1',
        codigo: 'QB',
        nombre: 'Quebracho',
        nombreCientifico: 'Schinopsis balansae',
        ordenVisual: 1,
      },
    ]);
  });

  test('propaga el error de Supabase', async () => {
    capturarConsultas(() => ({ error: { message: 'falló la red' } }));
    await expect(listarEspeciesDePlantacion('plant-1')).rejects.toThrow('falló la red');
  });
});

describe('listarEspeciesConUso', () => {
  test('marca tieneArboles con un count por especie (join trees → groups)', async () => {
    const consultas = capturarConsultas((consulta) => {
      if (consulta.tabla === 'plantation_species') {
        return { data: [filaAsignada(FILA_QUEBRACHO, 0), filaAsignada(FILA_ALGARROBO, 1)] };
      }
      const especieId = consulta.filtros.find((filtro) => filtro.columna === 'species_id')?.valor;
      return { count: especieId === 'sp-1' ? 3 : 0 };
    });
    const especies = await listarEspeciesConUso('plant-1');

    expect(especies.map((especie) => [especie.id, especie.tieneArboles])).toEqual([
      ['sp-1', true],
      ['sp-2', false],
    ]);
    const countsArboles = consultas.filter((consulta) => consulta.tabla === 'trees');
    expect(countsArboles).toHaveLength(2);
    expect(countsArboles[0].opciones).toEqual({ count: 'exact', head: true });
    expect(countsArboles[0].filtros).toEqual([
      { metodo: 'eq', columna: 'groups.plantation_id', valor: 'plant-1' },
      { metodo: 'eq', columna: 'species_id', valor: 'sp-1' },
    ]);
  });

  test('propaga el error del count de árboles', async () => {
    capturarConsultas((consulta) =>
      consulta.tabla === 'plantation_species'
        ? { data: [filaAsignada(FILA_QUEBRACHO, 0)] }
        : { error: { message: 'falló el count' } },
    );
    await expect(listarEspeciesConUso('plant-1')).rejects.toThrow('falló el count');
  });
});
