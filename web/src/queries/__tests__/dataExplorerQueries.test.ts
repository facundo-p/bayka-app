import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import {
  ARBOLES_POR_PAGINA,
  ESPECIE_SIN_IDENTIFICAR,
  listarArboles,
  listarGrupos,
  listarParcelasConStats,
} from '../dataExplorerQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

const FILA_PARCELA = {
  id: 'parc-1',
  nombre: 'Norte',
  codigo: 'P1',
  descripcion: 'Lindante al arroyo',
  created_at: '2026-06-01T12:00:00Z',
};

const FILA_GRUPO = {
  id: 'gr-1',
  nombre: 'Línea 1',
  codigo: 'L1',
  tipo: 'linea',
  estado: 'activa',
  parcela_id: 'parc-1',
  created_at: '2026-06-02T12:00:00Z',
  parcelas: { codigo: 'P1' },
};

/** Fila de trees con embeds y columnas GPS de la migración 023. */
const FILA_ARBOL = {
  id: 'tree-1',
  sub_id: 'A-001',
  posicion: 3,
  group_id: 'gr-1',
  species_id: 'sp-1',
  foto_url: 'plantations/p1/trees/tree-1.jpg',
  usuario_registro: 'user-9',
  created_at: '2026-06-03T12:00:00Z',
  latitude: -27.123456,
  longitude: -55.654321,
  gps_accuracy: 4.6,
  gps_captured_at: '2026-06-03T12:00:05Z',
  species: { codigo: 'QB', nombre: 'Quebracho' },
  groups: { codigo: 'L1', parcela_id: 'parc-1', plantation_id: 'plant-1' },
};

describe('listarParcelasConStats', () => {
  function responder(consulta: ConsultaCapturada): RespuestaMock {
    if (consulta.tabla === 'parcelas') return { data: [FILA_PARCELA] };
    if (consulta.tabla === 'groups') return { count: 4 };
    return { count: 120 };
  }

  test('excluye soft-deleted y cuenta grupos y árboles por parcela', async () => {
    const consultas = capturarConsultas(responder);
    const parcelas = await listarParcelasConStats('plant-1');

    expect(consultas[0].tabla).toBe('parcelas');
    expect(consultas[0].filtros).toEqual([
      { metodo: 'eq', columna: 'plantation_id', valor: 'plant-1' },
      { metodo: 'is', columna: 'deleted_at', valor: null },
    ]);
    expect(parcelas).toEqual([
      {
        id: 'parc-1',
        nombre: 'Norte',
        codigo: 'P1',
        descripcion: 'Lindante al arroyo',
        createdAt: '2026-06-01T12:00:00Z',
        grupos: 4,
        arboles: 120,
      },
    ]);
    const countArboles = consultas.find((consulta) => consulta.tabla === 'trees');
    expect(countArboles?.opciones).toEqual({ count: 'exact', head: true });
    expect(countArboles?.filtros).toEqual([
      { metodo: 'eq', columna: 'groups.parcela_id', valor: 'parc-1' },
    ]);
  });

  test('propaga el error de Supabase', async () => {
    capturarConsultas(() => ({ error: { message: 'sin permisos' } }));
    await expect(listarParcelasConStats('plant-1')).rejects.toThrow('sin permisos');
  });
});

describe('listarGrupos', () => {
  function responder(consulta: ConsultaCapturada): RespuestaMock {
    if (consulta.tabla === 'groups') return { data: [FILA_GRUPO, { ...FILA_GRUPO, id: 'gr-2' }] };
    // Lectura única de group_id de todos los árboles (agregado en cliente).
    return { data: [{ group_id: 'gr-1' }, { group_id: 'gr-1' }, { group_id: 'gr-1' }] };
  }

  test('embebe la parcela y agrega el count por grupo en cliente sin N+1', async () => {
    const consultas = capturarConsultas(responder);
    const grupos = await listarGrupos('plant-1');

    expect(grupos.map((grupo) => [grupo.id, grupo.parcelaCodigo, grupo.arboles])).toEqual([
      ['gr-1', 'P1', 3],
      ['gr-2', 'P1', 0],
    ]);
    const lecturas = consultas.filter((consulta) => consulta.tabla === 'trees');
    expect(lecturas).toHaveLength(1);
    expect(lecturas[0].columnas).toContain('group_id');
    expect(lecturas[0].limite).toBe(10000);
    expect(lecturas[0].filtros).toEqual([
      { metodo: 'eq', columna: 'groups.plantation_id', valor: 'plant-1' },
    ]);
  });

  test('aplica el filtro por parcela server-side', async () => {
    const consultas = capturarConsultas(responder);
    await listarGrupos('plant-1', { parcelaId: 'parc-1' });

    const consultaGrupos = consultas.find((consulta) => consulta.tabla === 'groups');
    expect(consultaGrupos?.filtros).toContainEqual({
      metodo: 'eq',
      columna: 'parcela_id',
      valor: 'parc-1',
    });
  });
});

describe('listarArboles', () => {
  test('pagina server-side con range de 50 y count exact, más nuevos primero', async () => {
    const consultas = capturarConsultas(() => ({ data: [FILA_ARBOL], count: 120 }));
    const pagina = await listarArboles('plant-1', {}, 2);

    expect(consultas[0].opciones).toEqual({ count: 'exact' });
    expect(consultas[0].orden).toEqual({ columna: 'created_at', ascending: false });
    expect(consultas[0].rango).toEqual({ desde: 50, hasta: 99 });
    expect(pagina.total).toBe(120);
    expect(pagina.totalPaginas).toBe(Math.ceil(120 / ARBOLES_POR_PAGINA));
  });

  test('mapea embeds y columnas GPS a camelCase', async () => {
    capturarConsultas(() => ({ data: [FILA_ARBOL], count: 1 }));
    const { arboles } = await listarArboles('plant-1');

    expect(arboles[0]).toEqual({
      id: 'tree-1',
      subId: 'A-001',
      posicion: 3,
      especieCodigo: 'QB',
      especieNombre: 'Quebracho',
      grupoId: 'gr-1',
      grupoCodigo: 'L1',
      parcelaId: 'parc-1',
      fotoUrl: 'plantations/p1/trees/tree-1.jpg',
      usuarioRegistro: 'user-9',
      createdAt: '2026-06-03T12:00:00Z',
      latitude: -27.123456,
      longitude: -55.654321,
      gpsAccuracy: 4.6,
      gpsCapturedAt: '2026-06-03T12:00:05Z',
    });
  });

  test('tolera columnas GPS ausentes (migración 023 sin aplicar) como undefined', async () => {
    const sinGps = { ...FILA_ARBOL, species_id: null, species: null } as Record<string, unknown>;
    delete sinGps.latitude;
    delete sinGps.longitude;
    delete sinGps.gps_accuracy;
    delete sinGps.gps_captured_at;
    capturarConsultas(() => ({ data: [sinGps], count: 1 }));

    const { arboles } = await listarArboles('plant-1');
    expect(arboles[0].latitude).toBeUndefined();
    expect(arboles[0].longitude).toBeUndefined();
    expect(arboles[0].gpsAccuracy).toBeUndefined();
    expect(arboles[0].especieCodigo).toBeNull();
  });

  test('aplica filtros server-side: parcela, grupo, especie, con GPS y búsqueda', async () => {
    const consultas = capturarConsultas(() => ({ data: [], count: 0 }));
    await listarArboles('plant-1', {
      parcelaId: 'parc-1',
      groupId: 'gr-1',
      speciesId: 'sp-1',
      conGps: true,
      busqueda: 'A-0',
    });

    expect(consultas[0].filtros).toEqual([
      { metodo: 'eq', columna: 'groups.plantation_id', valor: 'plant-1' },
      { metodo: 'eq', columna: 'groups.parcela_id', valor: 'parc-1' },
      { metodo: 'eq', columna: 'group_id', valor: 'gr-1' },
      { metodo: 'eq', columna: 'species_id', valor: 'sp-1' },
      { metodo: 'not', columna: 'latitude', operador: 'is', valor: null },
      { metodo: 'ilike', columna: 'sub_id', valor: '%A-0%' },
    ]);
  });

  test('especie N/N filtra species_id null y sin GPS filtra latitude null', async () => {
    const consultas = capturarConsultas(() => ({ data: [], count: 0 }));
    await listarArboles('plant-1', { speciesId: ESPECIE_SIN_IDENTIFICAR, conGps: false });

    expect(consultas[0].filtros).toContainEqual({
      metodo: 'is',
      columna: 'species_id',
      valor: null,
    });
    expect(consultas[0].filtros).toContainEqual({ metodo: 'is', columna: 'latitude', valor: null });
  });

  test('propaga el error de Supabase', async () => {
    capturarConsultas(() => ({ error: { message: 'falló la red' } }));
    await expect(listarArboles('plant-1')).rejects.toThrow('falló la red');
  });
});
