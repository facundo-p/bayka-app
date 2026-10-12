import { capturarConsultas } from '../../test/capturarConsultas';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { resetEstadoMock } from '../../test/supabaseMock';
import { reiniciarCacheCodigosPlantacion } from '../busquedaArbol';
import {
  leerArbolParaFicha,
  leerNombreOrganizacion,
  listarArbolesDelFiltro,
} from '../fichasQueries';
import { TAMANO_PAGINA } from '../leerPaginado';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(() => {
  resetEstadoMock();
  reiniciarCacheCodigosPlantacion();
});

function filaArbolFicha(id: string, sobre: Record<string, unknown> = {}) {
  return {
    id,
    sub_id: `SUB-${id}`,
    posicion: 23,
    foto_url: 'plantations/p1/trees/t.jpg',
    usuario_registro: 'user-9',
    created_at: '2025-11-14T15:00:00Z',
    latitude: -27.36,
    longitude: -55.89,
    gps_accuracy: 4.2,
    species: {
      codigo: 'ANC',
      nombre: 'Anchico',
      nombre_cientifico: 'Parapiptadenia rigida',
      tipo: 'flora',
      subtipo: 'arbol',
    },
    groups: {
      codigo: 'L10',
      nombre: 'Línea 10',
      parcela_id: 'parc-1',
      plantation_id: 'plant-1',
      plantations: { codigo: 'SS26' },
      parcelas: { codigo: 'LP12', nombre: 'Loma-P12', deleted_at: null as string | null },
    },
    ...sobre,
  };
}

describe('leerArbolParaFicha', () => {
  test('lee el árbol por id dentro de la plantación, con los embeds de la ficha', async () => {
    const consultas = capturarConsultas(() => ({ data: filaArbolFicha('t1') }));
    await leerArbolParaFicha('plant-1', 't1');

    expect(consultas[0].tabla).toBe('trees');
    expect(consultas[0].columnas).toContain(
      'species(codigo, nombre, nombre_cientifico, tipo, subtipo)',
    );
    expect(consultas[0].columnas).toContain('parcelas(codigo, nombre, deleted_at)');
    expect(consultas[0].columnas).not.toContain('global_id');
    expect(consultas[0].filtros).toEqual([
      { metodo: 'eq', columna: 'groups.plantation_id', valor: 'plant-1' },
      { metodo: 'eq', columna: 'id', valor: 't1' },
    ]);
  });

  test('mapea la fila completa', async () => {
    capturarConsultas(() => ({ data: filaArbolFicha('t1') }));
    const arbol = await leerArbolParaFicha('plant-1', 't1');

    expect(arbol).toEqual({
      id: 't1',
      subId: 'SUB-t1',
      idArbol: 'SUB-t1-SS26',
      posicion: 23,
      especie: {
        codigo: 'ANC',
        nombre: 'Anchico',
        nombreCientifico: 'Parapiptadenia rigida',
        tipo: 'flora',
        subtipo: 'arbol',
      },
      grupo: { codigo: 'L10', nombre: 'Línea 10' },
      parcela: { codigo: 'LP12', nombre: 'Loma-P12' },
      parcelaId: 'parc-1',
      fotoUrl: 'plantations/p1/trees/t.jpg',
      usuarioRegistro: 'user-9',
      createdAt: '2025-11-14T15:00:00Z',
      gps: { lat: -27.36, lng: -55.89, precision: 4.2 },
    });
  });

  test('N/N, sin GPS y parcela eliminada', async () => {
    const fila = filaArbolFicha('t1', {
      species: null,
      latitude: null,
      longitude: null,
    });
    fila.groups.parcelas = { ...fila.groups.parcelas, deleted_at: '2026-01-01T00:00:00Z' };
    capturarConsultas(() => ({ data: fila }));
    const arbol = await leerArbolParaFicha('plant-1', 't1');
    expect(arbol).toMatchObject({ especie: null, gps: null, parcela: null });
  });

  test('null si el árbol no está en la plantación', async () => {
    capturarConsultas(() => ({ data: null }));
    expect(await leerArbolParaFicha('plant-1', 'x')).toBeNull();
  });

  test('propaga el error de la consulta', async () => {
    capturarConsultas(() => ({ error: { message: 'boom' } }));
    await expect(leerArbolParaFicha('plant-1', 't1')).rejects.toThrow('boom');
  });
});

describe('listarArbolesDelFiltro', () => {
  const consultasDeArboles = (consultas: ConsultaCapturada[]) =>
    consultas.filter((consulta) => consulta.tabla === 'trees');

  test('aplica los filtros del listado, con los embeds !inner que piden', async () => {
    const consultas = capturarConsultas(() => ({ data: [filaArbolFicha('t1')] }));
    await listarArbolesDelFiltro('plant-1', {
      parcelaId: 'parc-1',
      groupId: 'gr-1',
      speciesId: 'sp-1',
      conGps: true,
      busqueda: 'L10',
    });

    const [consulta] = consultasDeArboles(consultas);
    expect(consulta.columnas).toContain('groups!inner(');
    expect(consulta.columnas).toContain('plantations!inner(codigo)');
    expect(consulta.filtros).toEqual([
      { metodo: 'eq', columna: 'groups.plantation_id', valor: 'plant-1' },
      { metodo: 'eq', columna: 'groups.parcela_id', valor: 'parc-1' },
      { metodo: 'eq', columna: 'group_id', valor: 'gr-1' },
      { metodo: 'eq', columna: 'species_id', valor: 'sp-1' },
      { metodo: 'not', columna: 'latitude', operador: 'is', valor: null },
      { metodo: 'ilike', columna: 'sub_id', valor: '%L10%' },
    ]);
  });

  test('un ID Árbol completo filtra por el código de la plantación embebida', async () => {
    const consultas = capturarConsultas((consulta) =>
      consulta.tabla === 'plantations'
        ? { data: [{ codigo: 'SS26' }] }
        : { data: [filaArbolFicha('t1')] },
    );
    await listarArbolesDelFiltro('plant-1', { busqueda: 'LP1L23BANC12-SS26' });

    const [consulta] = consultasDeArboles(consultas);
    expect(consulta.filtros).toContainEqual({
      metodo: 'eq',
      columna: 'groups.plantations.codigo',
      valor: 'SS26',
    });
  });

  test('ordena como el listado, con el id de desempate, y no pide count', async () => {
    const consultas = capturarConsultas(() => ({ data: [filaArbolFicha('t1')] }));
    await listarArbolesDelFiltro('plant-1', {});

    const [consulta] = consultasDeArboles(consultas);
    expect(consulta.ordenes).toEqual([
      { columna: 'created_at', ascending: false },
      { columna: 'id', ascending: false },
    ]);
    expect(consulta.opciones).toBeUndefined();
  });

  test('lee en lotes de 1.000 hasta agotar y mapea en orden', async () => {
    const lote = (desde: number, cantidad: number) =>
      Array.from({ length: cantidad }, (_, indice) => filaArbolFicha(`t${desde + indice}`));
    // Una página llena y una de 3: la segunda corta la lectura.
    const paginas = new Map([
      [0, lote(0, TAMANO_PAGINA)],
      [TAMANO_PAGINA, lote(TAMANO_PAGINA, 3)],
    ]);
    const consultas = capturarConsultas(({ rango }) => ({
      data: paginas.get(rango?.desde ?? 0) ?? [],
    }));
    const arboles = await listarArbolesDelFiltro('plant-1', {});

    expect(consultasDeArboles(consultas)[0].rango).toEqual({ desde: 0, hasta: 999 });
    expect(arboles).toHaveLength(TAMANO_PAGINA + 3);
    expect(arboles[0]).toMatchObject({ id: 't0', idArbol: 'SUB-t0-SS26' });
    expect(arboles.at(-1)?.id).toBe(`t${TAMANO_PAGINA + 2}`);
  });

  test('propaga el error de la consulta', async () => {
    capturarConsultas(() => ({ error: { message: 'boom' } }));
    await expect(listarArbolesDelFiltro('plant-1', {})).rejects.toThrow('boom');
  });
});

describe('leerNombreOrganizacion', () => {
  function responder(nombre: string | null) {
    return (consulta: ConsultaCapturada): RespuestaMock =>
      consulta.tabla === 'plantations'
        ? { data: { organizations: nombre ? { nombre } : null } }
        : { error: { message: 'inesperada' } };
  }

  test('embebe la organización de la plantación', async () => {
    const consultas = capturarConsultas(responder('Bayka Forestal'));
    expect(await leerNombreOrganizacion('plant-1')).toBe('Bayka Forestal');
    expect(consultas[0].columnas).toBe('organizations(nombre)');
    expect(consultas[0].filtros).toEqual([{ metodo: 'eq', columna: 'id', valor: 'plant-1' }]);
  });

  test('null si la policy no deja leerla', async () => {
    capturarConsultas(responder(null));
    expect(await leerNombreOrganizacion('plant-1')).toBeNull();
  });
});
