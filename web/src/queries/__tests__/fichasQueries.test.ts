import { capturarConsultas } from '../../test/capturarConsultas';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { resetEstadoMock } from '../../test/supabaseMock';
import { leerNombreOrganizacion, listarArbolesParaFichas } from '../fichasQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

function filaArbolFicha(id: string, sobre: Record<string, unknown> = {}) {
  return {
    id,
    sub_id: `SUB-${id}`,
    global_id: 10479,
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

describe('listarArbolesParaFichas', () => {
  test('lee por ids dentro de la plantación, con los embeds de la ficha', async () => {
    const consultas = capturarConsultas(() => ({ data: [filaArbolFicha('t1')] }));
    await listarArbolesParaFichas('plant-1', ['t1']);

    expect(consultas[0].tabla).toBe('trees');
    expect(consultas[0].columnas).toContain(
      'species(codigo, nombre, nombre_cientifico, tipo, subtipo)',
    );
    expect(consultas[0].columnas).toContain('parcelas(codigo, nombre, deleted_at)');
    expect(consultas[0].columnas).toContain('global_id');
    expect(consultas[0].filtros).toEqual([
      { metodo: 'eq', columna: 'groups.plantation_id', valor: 'plant-1' },
      { metodo: 'in', columna: 'id', valor: ['t1'] },
    ]);
  });

  test('mapea la fila completa', async () => {
    capturarConsultas(() => ({ data: [filaArbolFicha('t1')] }));
    const [arbol] = await listarArbolesParaFichas('plant-1', ['t1']);

    expect(arbol).toEqual({
      id: 't1',
      subId: 'SUB-t1',
      idArbol: 'SUB-t1-SS26',
      idGlobal: 10479,
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

  test('devuelve en el orden de los ids y omite los que no llegaron', async () => {
    capturarConsultas(() => ({ data: [filaArbolFicha('t2'), filaArbolFicha('t1')] }));
    const arboles = await listarArbolesParaFichas('plant-1', ['t1', 'x', 't2']);
    expect(arboles.map((arbol) => arbol.id)).toEqual(['t1', 't2']);
  });

  test('N/N, sin GPS, sin ID Global y parcela eliminada', async () => {
    const fila = filaArbolFicha('t1', {
      species: null,
      latitude: null,
      longitude: null,
      global_id: null,
    });
    fila.groups.parcelas = { ...fila.groups.parcelas, deleted_at: '2026-01-01T00:00:00Z' };
    capturarConsultas(() => ({ data: [fila] }));
    const [arbol] = await listarArbolesParaFichas('plant-1', ['t1']);
    expect(arbol).toMatchObject({ especie: null, gps: null, idGlobal: null, parcela: null });
  });

  test('sin ids no consulta', async () => {
    const consultas = capturarConsultas(() => ({ data: [] }));
    expect(await listarArbolesParaFichas('plant-1', [])).toEqual([]);
    expect(consultas).toHaveLength(0);
  });

  test('propaga el error de la consulta', async () => {
    capturarConsultas(() => ({ error: { message: 'boom' } }));
    await expect(listarArbolesParaFichas('plant-1', ['t1'])).rejects.toThrow('boom');
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
