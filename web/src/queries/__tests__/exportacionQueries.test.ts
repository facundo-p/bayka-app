import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { PAGINAS_EN_PARALELO } from '../leerPaginado';
import { listarFilasExportacion } from '../exportacionQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

const FILA_COMPLETA = {
  id: 'arbol-a',
  posicion: 1,
  sub_id: 'A-001',
  species: { nombre: 'Quebracho' },
  groups: {
    id: 'grupo-1',
    created_at: '2026-03-01T10:00:00+00:00',
    nombre: 'Línea 1',
    plantation_id: 'plant-1',
    plantations: { lugar: 'Sitio', periodo: '2025-2026', codigo: 'SS26-1' },
    parcelas: { nombre: 'Norte', deleted_at: null },
  },
};

const FILA_PARCELA_ELIMINADA = {
  ...FILA_COMPLETA,
  sub_id: 'C-003',
  groups: {
    ...FILA_COMPLETA.groups,
    parcelas: { nombre: 'Sur', deleted_at: '2026-01-01T00:00:00Z' },
  },
};

const FILA_HUERFANA = {
  id: 'arbol-b',
  posicion: 1,
  sub_id: 'B-002',
  species: null,
  groups: {
    id: 'grupo-2',
    created_at: '2026-03-02T10:00:00+00:00',
    nombre: 'Bosquete 2',
    plantation_id: 'plant-1',
    plantations: { lugar: 'Sitio', periodo: '2025-2026', codigo: 'SS26-1' },
    parcelas: null,
  },
};

const FILA_SIN_PLANTACION = {
  ...FILA_HUERFANA,
  sub_id: 'D-004',
  groups: { ...FILA_HUERFANA.groups, plantations: null },
};

describe('listarFilasExportacion', () => {
  test('acota por plantación, embebe grupo/plantations/parcelas/species y pagina por id', async () => {
    const consultas = capturarConsultas(() => ({ data: [FILA_COMPLETA] }));

    await listarFilasExportacion('plant-1');

    const deArboles = consultas.filter((consulta) => consulta.tabla === 'trees');
    expect(deArboles).toHaveLength(1);
    expect(deArboles[0].columnas).toContain('groups!inner(');
    expect(deArboles[0].columnas).toContain('plantations(lugar, periodo, codigo)');
    expect(deArboles[0].columnas).toContain('parcelas(nombre, deleted_at)');
    expect(deArboles[0].columnas).toContain('species(nombre)');
    expect(deArboles[0].columnas).toContain('groups!inner(id, created_at,');
    expect(deArboles[0].columnas).toContain('posicion');
    expect(deArboles[0].columnas).not.toContain('global_id');
    expect(deArboles[0].columnas).not.toContain('plantacion_id');
    expect(deArboles[0].filtros).toContainEqual({
      metodo: 'eq',
      columna: 'groups.plantation_id',
      valor: 'plant-1',
    });
    // Una clave única, para que la paginación no repita filas; el orden final es el del ID Parcial.
    expect(deArboles[0].ordenes).toEqual([{ columna: 'id', ascending: true }]);
    // Lectura paginada con `.range()`, no `.limit()`.
    expect(deArboles[0].rango).toEqual({ desde: 0, hasta: 999 });
    expect(deArboles[0].limite).toBeUndefined();
  });

  test('mapea embeds preservando nulls (parcela/especie null); ID Árbol = SubID-código', async () => {
    capturarConsultas(() => ({ data: [FILA_COMPLETA, FILA_HUERFANA] }));

    expect(await listarFilasExportacion('plant-1')).toEqual([
      {
        idArbol: 'A-001-SS26-1',
        idParcial: 1,
        zona: 'Sitio',
        plantacion: 'Sitio',
        parcela: 'Norte',
        grupo: 'Línea 1',
        subId: 'A-001',
        periodo: '2025-2026',
        especie: 'Quebracho',
      },
      {
        idArbol: 'B-002-SS26-1',
        idParcial: 2,
        zona: 'Sitio',
        plantacion: 'Sitio',
        parcela: null,
        grupo: 'Bosquete 2',
        subId: 'B-002',
        periodo: '2025-2026',
        especie: null,
      },
    ]);
  });

  test('numera el ID Parcial por alta del grupo y posición, no por el orden de lectura', async () => {
    const grupoViejo = {
      ...FILA_COMPLETA.groups,
      id: 'grupo-z',
      created_at: '2026-02-01T00:00:00Z',
    };
    capturarConsultas(() => ({
      data: [
        { ...FILA_COMPLETA, id: 'a1', sub_id: 'NUEVO-1' },
        { ...FILA_COMPLETA, id: 'a2', posicion: 2, sub_id: 'VIEJO-2', groups: grupoViejo },
        { ...FILA_COMPLETA, id: 'a3', posicion: 1, sub_id: 'VIEJO-1', groups: grupoViejo },
      ],
    }));

    const filas = await listarFilasExportacion('plant-1');

    expect(filas.map((fila) => [fila.subId, fila.idParcial])).toEqual([
      ['VIEJO-1', 1],
      ['VIEJO-2', 2],
      ['NUEVO-1', 3],
    ]);
  });

  test('sin plantación embebida: ID Árbol es solo el SubID y zona/plantación/período vacíos', async () => {
    capturarConsultas(() => ({ data: [FILA_SIN_PLANTACION] }));

    const [fila] = await listarFilasExportacion('plant-1');

    expect(fila).toMatchObject({
      idArbol: 'D-004',
      zona: '',
      plantacion: '',
      periodo: '',
      subId: 'D-004',
    });
  });

  test('una parcela soft-deleted no aparece en la planilla: mapea a null', async () => {
    capturarConsultas(() => ({ data: [FILA_PARCELA_ELIMINADA] }));

    const [fila] = await listarFilasExportacion('plant-1');

    expect(fila.parcela).toBeNull();
  });

  test('pagina sin truncar a 1000 (lee todas las filas con range)', async () => {
    const totalFilas = 1500;
    const responderPaginado = (consulta: ConsultaCapturada): RespuestaMock => {
      const { desde, hasta } = consulta.rango ?? { desde: 0, hasta: totalFilas - 1 };
      const filas = [];
      for (let indice = desde; indice <= hasta && indice < totalFilas; indice++) {
        filas.push({ ...FILA_COMPLETA, id: `arbol-${indice}`, sub_id: `A-${indice}` });
      }
      return { data: filas };
    };
    const consultas = capturarConsultas(responderPaginado);

    const filas = await listarFilasExportacion('plant-1');

    expect(filas).toHaveLength(totalFilas);
    const deArboles = consultas.filter((consulta) => consulta.tabla === 'trees');
    // Página 0 llena → una tanda en paralelo, cuya primera página (500) ya es la última.
    expect(deArboles).toHaveLength(1 + PAGINAS_EN_PARALELO);
    expect(deArboles[0].rango).toEqual({ desde: 0, hasta: 999 });
    expect(deArboles[1].rango).toEqual({ desde: 1000, hasta: 1999 });
  });

  test('propaga el error de Supabase', async () => {
    capturarConsultas(() => ({ error: { message: 'sin permisos' } }));
    await expect(listarFilasExportacion('plant-1')).rejects.toThrow('sin permisos');
  });
});
