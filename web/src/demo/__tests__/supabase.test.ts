import { describe, expect, it, vi } from 'vitest';
import type { FilaDemo } from '../datos';
import { supabase } from '../supabase';
import { buscar } from '../../queries/buscarQueries';
import { obtenerFuenteDashboard } from '../../queries/dashboardQueries';
import {
  listarArboles,
  listarGrupos,
  listarParcelasConStats,
} from '../../queries/dataExplorerQueries';
import { condicionIlikeOr } from '../../queries/escaparBusqueda';
import {
  listarEspeciesDePlantacion,
  listarPlantacionesDeEspecie,
} from '../../queries/especieQueries';
import { listarPuntosGps } from '../../queries/mapaQueries';

// Como en `dev:demo`: las queries reales corren contra el cliente falso.
vi.mock('../../lib/supabase', () => import('../supabase'));

async function plantacionesConArboles(): Promise<string[]> {
  const { data } = await supabase.rpc('stats_plantaciones');
  return (data as FilaDemo[])
    .filter((stats) => Number(stats.arboles) > 0)
    .map((stats) => String(stats.plantation_id));
}

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
      .eq('id', 'g1-t1')
      .single();

    expect((data as FilaDemo).groups).toMatchObject({
      nombre: 'Línea 10',
      plantations: { lugar: 'San Sebastián' },
      parcelas: { codigo: 'LP12' },
    });
  });

  it('no agrega un embebido sin FK modelada', async () => {
    const { data } = await supabase
      .from('plantations')
      .select('id, groups(id)')
      .eq('id', 'p1')
      .single();

    expect(data).not.toHaveProperty('groups');
  });
});

describe('cliente demo: filtros sobre columnas embebidas', () => {
  it('filtra por la columna del embebido', async () => {
    const enP1 = await listarArboles('p1');
    const enP2 = await listarArboles('p2');

    expect(enP1.total).toBe(24);
    expect(enP2.total).toBe(32);
    expect(enP2.arboles.every((arbol) => arbol.grupoId.startsWith('p2-'))).toBe(true);
  });

  it('filtra por la columna de un embebido anidado', async () => {
    const consulta = (estado: string) =>
      supabase
        .from('trees')
        .select('id, groups!inner(plantations!inner(estado))')
        .eq('groups.plantations.estado', estado);

    expect(((await consulta('activa')).data as FilaDemo[]).length).toBe(120);
    expect(((await consulta('finalizada')).data as FilaDemo[]).length).toBe(96);
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

describe('cliente demo: conteos por parcela', () => {
  it('el conteo filtrado por parcela no devuelve el total de la plantación', async () => {
    const parcelas = await listarParcelasConStats('p1');

    expect(parcelas.map(({ codigo, arboles }) => [codigo, arboles])).toEqual([
      ['LP12', 16],
      ['BA03', 8],
    ]);
  });

  it.each(['p1', 'p2', 'p4'])(
    'en %s cada parcela suma los árboles de sus grupos',
    async (plantacion) => {
      const [parcelas, grupos] = await Promise.all([
        listarParcelasConStats(plantacion),
        listarGrupos(plantacion),
      ]);
      const sumaDeGrupos = (parcelaId: string) =>
        grupos
          .filter((grupo) => grupo.parcelaId === parcelaId)
          .reduce((total, grupo) => total + grupo.arboles, 0);

      expect(parcelas.length).toBeGreaterThan(0);
      for (const parcela of parcelas) {
        expect(parcela.arboles).toBeGreaterThan(0);
        expect(parcela.arboles).toBe(sumaDeGrupos(parcela.id));
      }
    },
  );
});

describe('cliente demo: árboles de muestra', () => {
  it('cada plantación con árboles en la matriz tiene filas de especies que habilita', async () => {
    for (const plantacion of await plantacionesConArboles()) {
      const [{ arboles }, especies] = await Promise.all([
        listarArboles(plantacion),
        listarEspeciesDePlantacion(plantacion),
      ]);
      const habilitadas = especies.map(({ codigo }) => codigo);

      expect(arboles.length, plantacion).toBeGreaterThan(0);
      expect(arboles.every(({ especieCodigo }) => habilitadas.includes(especieCodigo ?? ''))).toBe(
        true,
      );
    }
  });

  it('la tarjeta cuenta las parcelas que lista el explorador', async () => {
    const { data } = await supabase.rpc('stats_plantaciones');

    for (const stats of data as FilaDemo[]) {
      const parcelas = await listarParcelasConStats(String(stats.plantation_id));
      expect(stats.parcelas, String(stats.plantation_id)).toBe(parcelas.length);
    }
  });

  it('el dashboard y el mapa de p2 tienen árboles', async () => {
    const [fuente, puntos] = await Promise.all([
      obtenerFuenteDashboard('p2'),
      listarPuntosGps('p2'),
    ]);

    expect(fuente.arboles).toHaveLength(32);
    expect(fuente.parcelas).toHaveLength(2);
    expect(puntos.length).toBeGreaterThan(0);
  });
});

describe('cliente demo: or(), ilike y paginación', () => {
  it('la búsqueda de parcelas encuentra por nombre sin importar mayúsculas', async () => {
    const resultados = await buscar('loma');

    expect(resultados.map(({ tipo, titulo }) => [tipo, titulo])).toEqual([
      ['parcela', 'LP12 · Loma-P12'],
    ]);
  });

  it('la búsqueda de grupos filtra por código y los árboles respetan el tope', async () => {
    const resultados = await buscar('l1', { plantationId: 'p1' });
    const deTipo = (tipo: string) => resultados.filter((resultado) => resultado.tipo === tipo);

    expect(deTipo('grupo').map(({ titulo }) => titulo)).toEqual([
      'L10 · Línea 10',
      'L11 · Línea 11',
    ]);
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

    expect(sinFoto.total).toBe(15);
    expect(conFoto.total).toBe(9);
  });

  it('el filtro de texto de árboles es ilike real', async () => {
    const { arboles, total } = await listarArboles('p1', { busqueda: 'anc' });

    expect(total).toBe(6);
    expect(arboles.every((arbol) => arbol.subId.includes('ANC'))).toBe(true);
  });

  it('range recorta la página y count es el total', async () => {
    const { data, count } = await supabase
      .from('trees')
      .select('id', { count: 'exact' })
      .range(0, 9);

    expect(data).toHaveLength(10);
    expect(count).toBe(216);
  });

  it('un operador que no simula tira un error claro', () => {
    const consulta = () => supabase.from('trees').select('id');

    expect(() => consulta().or('sub_id.fts.anc')).toThrow('"fts"');
    expect(() => consulta().not('posicion', 'gt', 3)).toThrow('"gt"');
  });
});
