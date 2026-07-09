import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { buscar } from '../buscarQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

const FILA_PLANTACION = {
  id: 'plant-1',
  lugar: 'La Maluka',
  periodo: 'Otoño 2026',
  estado: 'activa',
  created_at: '2026-04-01T00:00:00Z',
};

const FILA_ESPECIE = {
  id: 'sp-1',
  codigo: 'QB',
  nombre: 'Quebracho',
  nombre_cientifico: 'Schinopsis balansae',
};

const FILA_USUARIO = {
  id: 'user-1',
  nombre: 'Ana Admin',
  rol: 'admin',
  organizacion_id: 'org-1',
  created_at: '2026-01-01T00:00:00Z',
};

const FILA_ARBOL = {
  id: 'tree-1',
  sub_id: 'PAL23ANC12',
  species: { nombre: 'Quebracho' },
  groups: { plantation_id: 'plant-1', codigo: 'L1' },
};

const FILA_PARCELA = {
  id: 'parc-1',
  nombre: 'Norte',
  codigo: 'P1',
  plantation_id: 'plant-1',
  plantations: { lugar: 'La Maluka' },
};

const FILA_GRUPO = {
  id: 'gr-1',
  nombre: 'Línea 1',
  codigo: 'L1',
  plantation_id: 'plant-1',
  parcelas: { codigo: 'P1' },
};

/** Resolver que enruta cada tabla a su fila de fixture. */
function responder(consulta: ConsultaCapturada): RespuestaMock {
  switch (consulta.tabla) {
    case 'plantations':
      return { data: [FILA_PLANTACION] };
    case 'species':
      return { data: [FILA_ESPECIE] };
    case 'profiles':
      return { data: [FILA_USUARIO] };
    case 'trees':
      return { data: [FILA_ARBOL] };
    case 'parcelas':
      return { data: [FILA_PARCELA] };
    case 'groups':
      return { data: [FILA_GRUPO] };
    // plantation_users / organizations: counts y nombres de usuarioQueries.
    default:
      return { data: [], count: 0 };
  }
}

test('texto vacío o muy corto no consulta nada', async () => {
  const consultas = capturarConsultas(responder);
  expect(await buscar('')).toEqual([]);
  expect(await buscar('   ')).toEqual([]);
  expect(consultas).toHaveLength(0);
});

test('agrega coincidencias de listas cacheadas (plantación, especie, usuario)', async () => {
  capturarConsultas(responder);
  const resultados = await buscar('a');
  const tipos = resultados.map((resultado) => resultado.tipo);

  expect(tipos).toContain('plantacion');
  expect(tipos).toContain('especie');
  expect(tipos).toContain('usuario');

  const plantacion = resultados.find((resultado) => resultado.tipo === 'plantacion');
  expect(plantacion).toMatchObject({
    titulo: 'La Maluka',
    meta: 'Otoño 2026',
    to: '/plantaciones/plant-1',
  });
  const usuario = resultados.find((resultado) => resultado.tipo === 'usuario');
  expect(usuario).toMatchObject({ titulo: 'Ana Admin', meta: 'admin', to: '/usuarios' });
});

test('encuentra un árbol por sub_id y navega a su contexto de datos', async () => {
  capturarConsultas(responder);
  const resultados = await buscar('PAL23');
  const arbol = resultados.find((resultado) => resultado.tipo === 'arbol');

  expect(arbol).toMatchObject({
    titulo: 'PAL23ANC12',
    meta: 'Quebracho',
    to: '/plantaciones/plant-1/datos/arboles?q=PAL23ANC12',
  });
});

test('la búsqueda de árbol usa ilike sobre sub_id', async () => {
  const consultas = capturarConsultas(responder);
  await buscar('PAL23');
  const consultaArbol = consultas.find((consulta) => consulta.tabla === 'trees');
  expect(consultaArbol?.filtros).toContainEqual({
    metodo: 'ilike',
    columna: 'sub_id',
    valor: '%pal23%',
  });
});

test('respeta el scope: árboles acotados a la plantación vía groups.plantation_id', async () => {
  const consultas = capturarConsultas(responder);
  await buscar('PAL23', { plantationId: 'plant-1' });

  const consultaArbol = consultas.find((consulta) => consulta.tabla === 'trees');
  expect(consultaArbol?.filtros).toContainEqual({
    metodo: 'eq',
    columna: 'groups.plantation_id',
    valor: 'plant-1',
  });
  const consultaParcela = consultas.find((consulta) => consulta.tabla === 'parcelas');
  expect(consultaParcela?.filtros).toContainEqual({
    metodo: 'eq',
    columna: 'plantation_id',
    valor: 'plant-1',
  });
});

/** ¿La consulta es la búsqueda de árbol (ilike sub_id), no un count de trees? */
function esBusquedaArbol(consulta: ConsultaCapturada): boolean {
  return (
    consulta.tabla === 'trees' &&
    consulta.filtros.some((filtro) => filtro.metodo === 'ilike' && filtro.columna === 'sub_id')
  );
}

test('buscarParcelas mapea a resultado de parcela con su plantación y ruta', async () => {
  capturarConsultas(responder);
  const resultados = await buscar('P1');
  const parcela = resultados.find((resultado) => resultado.tipo === 'parcela');

  expect(parcela).toMatchObject({
    titulo: 'P1 · Norte',
    meta: 'La Maluka',
    to: '/plantaciones/plant-1/datos/parcelas',
  });
});

test('la búsqueda de parcelas arma un .or con ilike escapado sobre código y nombre', async () => {
  const consultas = capturarConsultas(responder);
  await buscar('P1');
  const consultaParcela = consultas.find((consulta) => consulta.tabla === 'parcelas');
  const filtroOr = consultaParcela?.filtros.find((filtro) => filtro.metodo === 'or');
  // El texto se normaliza a minúsculas y el valor va entrecomillado (escaparBusqueda).
  expect(filtroOr?.valor).toBe('codigo.ilike."%p1%",nombre.ilike."%p1%"');
});

test('buscarGrupos mapea a resultado de grupo con su parcela y ruta', async () => {
  capturarConsultas(responder);
  const resultados = await buscar('L1');
  const grupo = resultados.find((resultado) => resultado.tipo === 'grupo');

  expect(grupo).toMatchObject({
    titulo: 'L1 · Línea 1',
    meta: 'Parcela P1',
    to: '/plantaciones/plant-1/datos/grupos',
  });
});

test('tolera error de la búsqueda de árbol sin romper el resto', async () => {
  capturarConsultas((consulta) =>
    esBusquedaArbol(consulta) ? { error: { message: 'sin permisos' } } : responder(consulta),
  );
  const resultados = await buscar('a');
  expect(resultados.some((resultado) => resultado.tipo === 'arbol')).toBe(false);
  expect(resultados.some((resultado) => resultado.tipo === 'plantacion')).toBe(true);
});
