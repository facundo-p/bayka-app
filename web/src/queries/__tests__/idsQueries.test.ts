import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada } from '../../test/queryBuilderMock';
import { ERRORES_GENERACION_IDS, generarIds, idsGenerados, seedSugerido } from '../idsQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

/** El conteo "sólo con id" se distingue por el filtro sobre global_id. */
function configurarConteos(total: number, conId: number) {
  estadoMock.resolverConsulta = (consulta) => {
    const soloConId = consulta.filtros.some((filtro) => filtro.columna === 'global_id');
    return { count: soloConId ? conId : total, error: null };
  };
}

test('true cuando todos los árboles tienen global_id', async () => {
  configurarConteos(5, 5);
  await expect(idsGenerados('p1')).resolves.toBe(true);
});

test('false si el set es parcial (sync incompleto)', async () => {
  configurarConteos(5, 3);
  await expect(idsGenerados('p1')).resolves.toBe(false);
});

test('false si la plantación no tiene árboles', async () => {
  configurarConteos(0, 0);
  await expect(idsGenerados('p1')).resolves.toBe(false);
});

test('cuenta con global_id no nulo y acota por plantación', async () => {
  const consultas: ConsultaCapturada[] = [];
  estadoMock.resolverConsulta = (consulta) => {
    consultas.push(consulta);
    return { count: 1, error: null };
  };
  await idsGenerados('p1');
  const conId = consultas.find((consulta) =>
    consulta.filtros.some((filtro) => filtro.columna === 'global_id'),
  );
  expect(conId?.opciones).toEqual({ count: 'exact', head: true });
  expect(conId?.filtros).toContainEqual({
    metodo: 'not',
    columna: 'global_id',
    operador: 'is',
    valor: null,
  });
  expect(conId?.filtros).toContainEqual({
    metodo: 'eq',
    columna: 'groups.plantation_id',
    valor: 'p1',
  });
});

// ─── seedSugerido ────────────────────────────────────────────────────────────

test('seedSugerido devuelve MAX(global_id) + 1 (orden descendente + limit 1)', async () => {
  const consultas: ConsultaCapturada[] = [];
  estadoMock.resolverConsulta = (consulta) => {
    consultas.push(consulta);
    return { data: [{ global_id: 41 }] };
  };
  await expect(seedSugerido()).resolves.toBe(42);
  expect(consultas[0].tabla).toBe('trees');
  expect(consultas[0].filtros).toContainEqual({
    metodo: 'not',
    columna: 'global_id',
    operador: 'is',
    valor: null,
  });
  expect(consultas[0].orden).toEqual({ columna: 'global_id', ascending: false });
  expect(consultas[0].limite).toBe(1);
});

test('seedSugerido arranca en 1 cuando ningún árbol tiene global_id', async () => {
  estadoMock.resolverConsulta = () => ({ data: [] });
  await expect(seedSugerido()).resolves.toBe(1);
});

// ─── generarIds ──────────────────────────────────────────────────────────────

test('generarIds invoca el RPC con plantación y seed, y devuelve updated/seed', async () => {
  const consultas: ConsultaCapturada[] = [];
  estadoMock.resolverConsulta = (consulta) => {
    consultas.push(consulta);
    return { data: { success: true, updated: 7, seed: 100 } };
  };
  await expect(generarIds('p1', 100)).resolves.toEqual({ updated: 7, seed: 100 });
  expect(consultas[0]).toMatchObject({
    tabla: 'generate_tree_ids',
    operacion: 'rpc',
    payload: { p_plantation_id: 'p1', p_seed: 100 },
  });
});

test('generarIds traduce NOT_AUTHORIZED a un mensaje en español', async () => {
  estadoMock.resolverConsulta = () => ({
    data: { success: false, error: ERRORES_GENERACION_IDS.NO_AUTORIZADO },
  });
  await expect(generarIds('p1', 1)).rejects.toThrow(
    'Tu usuario no tiene permisos para generar IDs.',
  );
});

test('generarIds traduce ALREADY_GENERATED (carrera con otra sesión)', async () => {
  estadoMock.resolverConsulta = () => ({
    data: { success: false, error: ERRORES_GENERACION_IDS.YA_GENERADOS },
  });
  await expect(generarIds('p1', 1)).rejects.toThrow(
    'Los IDs de esta plantación ya fueron generados (quizás desde otra sesión).',
  );
});

test('generarIds con error de transporte lanza el mensaje genérico', async () => {
  estadoMock.resolverConsulta = () => ({ error: { message: 'network down' } });
  await expect(generarIds('p1', 1)).rejects.toThrow(
    'No se pudieron generar los IDs. Probá de nuevo.',
  );
});
