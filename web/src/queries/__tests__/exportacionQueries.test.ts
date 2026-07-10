import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { listarFilasExportacion } from '../exportacionQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

const FILA_COMPLETA = {
  global_id: 1001,
  plantacion_id: 12,
  sub_id: 'A-001',
  species: { nombre: 'Quebracho' },
  groups: {
    nombre: 'Línea 1',
    plantation_id: 'plant-1',
    plantations: { lugar: 'Sitio', periodo: '2025-2026' },
    parcelas: { nombre: 'Norte' },
  },
};

const FILA_HUERFANA = {
  global_id: null,
  plantacion_id: null,
  sub_id: 'B-002',
  species: null,
  groups: {
    nombre: 'Bosquete 2',
    plantation_id: 'plant-1',
    plantations: { lugar: 'Sitio', periodo: '2025-2026' },
    parcelas: null,
  },
};

describe('listarFilasExportacion', () => {
  test('acota por plantación, embebe plantations/parcelas/species y ordena por global_id asc', async () => {
    const consultas = capturarConsultas(() => ({ data: [FILA_COMPLETA] }));

    await listarFilasExportacion('plant-1');

    const deArboles = consultas.filter((consulta) => consulta.tabla === 'trees');
    expect(deArboles).toHaveLength(1);
    expect(deArboles[0].columnas).toContain('groups!inner(');
    expect(deArboles[0].columnas).toContain('plantations(lugar, periodo)');
    expect(deArboles[0].columnas).toContain('parcelas(nombre)');
    expect(deArboles[0].columnas).toContain('species(nombre)');
    expect(deArboles[0].columnas).toContain('global_id');
    expect(deArboles[0].columnas).toContain('plantacion_id');
    expect(deArboles[0].filtros).toContainEqual({
      metodo: 'eq',
      columna: 'groups.plantation_id',
      valor: 'plant-1',
    });
    expect(deArboles[0].orden).toEqual({ columna: 'global_id', ascending: true });
    // Lectura paginada con `.range()`, no `.limit()`.
    expect(deArboles[0].rango).toEqual({ desde: 0, hasta: 999 });
    expect(deArboles[0].limite).toBeUndefined();
  });

  test('mapea embeds preservando nulls (parcela/especie null, ids null)', async () => {
    capturarConsultas(() => ({ data: [FILA_COMPLETA, FILA_HUERFANA] }));

    expect(await listarFilasExportacion('plant-1')).toEqual([
      {
        idGlobal: 1001,
        idParcial: 12,
        zona: 'Sitio',
        plantacion: 'Sitio',
        parcela: 'Norte',
        grupo: 'Línea 1',
        subId: 'A-001',
        periodo: '2025-2026',
        especie: 'Quebracho',
      },
      {
        idGlobal: null,
        idParcial: null,
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

  test('pagina sin truncar a 1000 (lee todas las filas con range)', async () => {
    const totalFilas = 1500;
    const responderPaginado = (consulta: ConsultaCapturada): RespuestaMock => {
      const { desde, hasta } = consulta.rango ?? { desde: 0, hasta: totalFilas - 1 };
      const filas = [];
      for (let indice = desde; indice <= hasta && indice < totalFilas; indice++) {
        filas.push({ ...FILA_COMPLETA, sub_id: `A-${indice}` });
      }
      return { data: filas };
    };
    const consultas = capturarConsultas(responderPaginado);

    const filas = await listarFilasExportacion('plant-1');

    expect(filas).toHaveLength(totalFilas);
    const deArboles = consultas.filter((consulta) => consulta.tabla === 'trees');
    // Página 0 llena (1000) + página 1 parcial (500) → dos viajes.
    expect(deArboles).toHaveLength(2);
    expect(deArboles[0].rango).toEqual({ desde: 0, hasta: 999 });
    expect(deArboles[1].rango).toEqual({ desde: 1000, hasta: 1999 });
  });

  test('propaga el error de Supabase', async () => {
    capturarConsultas(() => ({ error: { message: 'sin permisos' } }));
    await expect(listarFilasExportacion('plant-1')).rejects.toThrow('sin permisos');
  });
});
