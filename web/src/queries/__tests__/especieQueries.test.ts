import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import {
  listarCatalogo,
  listarCatalogoConUso,
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

describe('listarCatalogoConUso', () => {
  test('cuenta plantaciones por especie y árboles totales, manteniendo el orden del catálogo', async () => {
    capturarConsultas((consulta) => {
      if (consulta.tabla === 'species') return { data: [FILA_QUEBRACHO, FILA_ALGARROBO] };
      if (consulta.tabla === 'plantation_species') {
        // Quebracho habilitado en 2 plantaciones; Algarrobo en ninguna.
        return { data: [{ species_id: 'sp-1' }, { species_id: 'sp-1' }] };
      }
      // trees: count head por especie.
      const especieId = consulta.filtros.find((filtro) => filtro.columna === 'species_id')?.valor;
      return { count: especieId === 'sp-1' ? 42 : 0 };
    });

    const catalogo = await listarCatalogoConUso();

    expect(catalogo).toEqual([
      {
        id: 'sp-1',
        codigo: 'QB',
        nombre: 'Quebracho',
        nombreCientifico: 'Schinopsis balansae',
        plantaciones: 2,
        arboles: 42,
      },
      {
        id: 'sp-2',
        codigo: 'AL',
        nombre: 'Algarrobo',
        nombreCientifico: null,
        plantaciones: 0,
        arboles: 0,
      },
    ]);
  });

  test('cuenta plantaciones por especie sin truncar a 1000 (pagina con range)', async () => {
    const totalFilas = 1500;
    const consultas = capturarConsultas((consulta) => {
      if (consulta.tabla === 'species') return { data: [FILA_QUEBRACHO] };
      if (consulta.tabla === 'plantation_species') {
        // Slice [desde, hasta] de 1500 filas, todas de la misma especie.
        const { desde, hasta } = consulta.rango ?? { desde: 0, hasta: totalFilas - 1 };
        const filas: Array<{ species_id: string }> = [];
        for (let indice = desde; indice <= hasta && indice < totalFilas; indice++) {
          filas.push({ species_id: 'sp-1' });
        }
        return { data: filas };
      }
      return { count: 0 };
    });

    const catalogo = await listarCatalogoConUso();

    expect(catalogo[0].plantaciones).toBe(totalFilas);
    const lecturas = consultas.filter((consulta) => consulta.tabla === 'plantation_species');
    // Página 0 llena (1000) + página 1 parcial (500) → dos viajes, sin truncar.
    expect(lecturas).toHaveLength(2);
    expect(lecturas[0].rango).toEqual({ desde: 0, hasta: 999 });
    expect(lecturas[1].rango).toEqual({ desde: 1000, hasta: 1999 });
  });

  test('propaga el error de la lectura de plantation_species', async () => {
    capturarConsultas((consulta) => {
      if (consulta.tabla === 'species') return { data: [FILA_QUEBRACHO] };
      if (consulta.tabla === 'plantation_species') return { error: { message: 'sin permisos' } };
      return { count: 0 };
    });
    await expect(listarCatalogoConUso()).rejects.toThrow('sin permisos');
  });
});
