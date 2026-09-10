import { describe, expect, it, vi } from 'vitest';
import type { FilaDemo } from '../datos';
import { supabase } from '../supabase';
import { buscar } from '../../queries/buscarQueries';
import { listarArboles } from '../../queries/dataExplorerQueries';
import { condicionIlikeOr } from '../../queries/escaparBusqueda';
import { listarPlantacionesDeEspecie } from '../../queries/especieQueries';

// Como en `dev:demo`: las queries reales corren contra el cliente falso.
vi.mock('../../lib/supabase', () => import('../supabase'));

describe('cliente demo: selects con embebidos', () => {
  it('resuelve el embebido many-to-one por su FK', async () => {
    const { data } = await supabase
      .from('plantation_species')
      .select('plantation_id, plantations(id, lugar)')
      .eq('species_id', 's1');

    const lugares = (data as FilaDemo[]).map((fila) => (fila.plantations as FilaDemo).lugar);
    expect(lugares).toEqual(['San Sebastián', 'Estancia La Escondida', 'Campo Los Molles']);
  });

  it('resuelve embebidos anidados y con hint', async () => {
    const { data } = await supabase
      .from('trees')
      .select('id, groups!inner(nombre, plantations(lugar), parcelas(codigo))')
      .eq('id', 't1')
      .single();

    expect((data as FilaDemo).groups).toMatchObject({
      nombre: 'Línea 10',
      plantations: { lugar: 'San Sebastián' },
      parcelas: { codigo: 'LP12' },
    });
  });

  it('no agrega un embebido sin FK modelada', async () => {
    const { data } = await supabase.from('plantations').select('id, groups(id)').eq('id', 'p1').single();

    expect(data).not.toHaveProperty('groups');
  });
});

describe('cliente demo: filtros sobre columnas embebidas', () => {
  it('filtra por la columna del embebido', async () => {
    const enP1 = await listarArboles('p1');
    const enP2 = await listarArboles('p2');

    expect(enP1.total).toBe(30);
    expect(enP2.total).toBe(0);
  });

  it('filtra por la columna de un embebido anidado', async () => {
    const consulta = (estado: string) =>
      supabase
        .from('trees')
        .select('id, groups!inner(plantations!inner(estado))')
        .eq('groups.plantations.estado', estado);

    expect(((await consulta('activa')).data as FilaDemo[]).length).toBe(30);
    expect(((await consulta('finalizada')).data as FilaDemo[]).length).toBe(0);
  });

  it('el panel de especie recibe nombre y conteo propio de cada plantación', async () => {
    const plantaciones = await listarPlantacionesDeEspecie('s1');

    expect(plantaciones.map(({ nombre, arboles }) => [nombre, arboles])).toEqual([
      ['Campo Los Molles', 2382],
      ['Estancia La Escondida', 2018],
      ['San Sebastián', 1002],
    ]);
  });
});

describe('cliente demo: or(), ilike y paginación', () => {
  it('la búsqueda de parcelas encuentra por nombre sin importar mayúsculas', async () => {
    const resultados = await buscar('loma');

    expect(resultados.map(({ tipo, titulo }) => [tipo, titulo])).toEqual([['parcela', 'LP12 · Loma-P12']]);
  });

  it('la búsqueda de grupos filtra por código y los árboles respetan el tope', async () => {
    const resultados = await buscar('l1');
    const deTipo = (tipo: string) => resultados.filter((resultado) => resultado.tipo === tipo);

    expect(deTipo('grupo').map(({ titulo }) => titulo)).toEqual(['L10 · Línea 10', 'L11 · Línea 11']);
    expect(deTipo('arbol')).toHaveLength(8);
  });

  it('una coma entre comillas no separa condiciones', async () => {
    const { data } = await supabase
      .from('parcelas')
      .select('id')
      .or(condicionIlikeOr('descripcion', 'alta, suelo'));

    expect(data).toEqual([{ id: 'pa1' }].map((fila) => expect.objectContaining(fila)));
  });

  it('combina is.null y like dentro de or() y los niega con not()', async () => {
    const sinFoto = await listarArboles('p1', { conFoto: false });
    const conFoto = await listarArboles('p1', { conFoto: true });

    expect(sinFoto.total).toBe(20);
    expect(conFoto.total).toBe(10);
  });

  it('el filtro de texto de árboles es ilike real', async () => {
    const { arboles, total } = await listarArboles('p1', { busqueda: 'anc' });

    expect(total).toBe(8);
    expect(arboles.every((arbol) => arbol.subId.includes('ANC'))).toBe(true);
  });

  it('range recorta la página y count es el total', async () => {
    const { data, count } = await supabase.from('trees').select('id', { count: 'exact' }).range(0, 9);

    expect(data).toHaveLength(10);
    expect(count).toBe(30);
  });

  it('un operador que no simula tira un error claro', () => {
    const consulta = () => supabase.from('trees').select('id');

    expect(() => consulta().or('sub_id.fts.anc')).toThrow('"fts"');
    expect(() => consulta().not('posicion', 'gt', 3)).toThrow('"gt"');
  });
});
