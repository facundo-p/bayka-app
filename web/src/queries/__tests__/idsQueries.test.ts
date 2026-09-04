import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada } from '../../test/queryBuilderMock';
import { ERRORES_GENERACION_IDS, generarIds, idsGenerados, seedSugerido } from '../idsQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

// ─── idsGenerados ─────────────────────────────────────────────────────────────

test('true cuando todos los árboles tienen global_id', async () => {
  estadoMock.resolverConsulta = () => ({
    data: [{ total: 5, con_id: 5, generados: true }],
  });
  await expect(idsGenerados('p1')).resolves.toBe(true);
});

test('false si el set es parcial (sync incompleto)', async () => {
  estadoMock.resolverConsulta = () => ({
    data: [{ total: 5, con_id: 3, generados: false }],
  });
  await expect(idsGenerados('p1')).resolves.toBe(false);
});

test('false si la plantación no tiene árboles', async () => {
  estadoMock.resolverConsulta = () => ({
    data: [{ total: 0, con_id: 0, generados: false }],
  });
  await expect(idsGenerados('p1')).resolves.toBe(false);
});

test('false si el RPC devuelve un array vacío', async () => {
  estadoMock.resolverConsulta = () => ({ data: [] });
  await expect(idsGenerados('p1')).resolves.toBe(false);
});

test('invoca el RPC plantation_ids_status con la plantación', async () => {
  const consultas: ConsultaCapturada[] = [];
  estadoMock.resolverConsulta = (consulta) => {
    consultas.push(consulta);
    return { data: [{ total: 1, con_id: 1, generados: true }] };
  };
  await idsGenerados('p1');
  expect(consultas[0]).toMatchObject({
    tabla: 'plantation_ids_status',
    operacion: 'rpc',
    payload: { p_plantation_id: 'p1' },
  });
});

// ─── seedSugerido ────────────────────────────────────────────────────────────

test('seedSugerido devuelve el valor del RPC next_global_id_seed', async () => {
  const consultas: ConsultaCapturada[] = [];
  estadoMock.resolverConsulta = (consulta) => {
    consultas.push(consulta);
    return { data: 42 };
  };
  await expect(seedSugerido()).resolves.toBe(42);
  expect(consultas[0]).toMatchObject({ tabla: 'next_global_id_seed', operacion: 'rpc' });
});

test('seedSugerido arranca en 1 cuando el RPC devuelve 1', async () => {
  estadoMock.resolverConsulta = () => ({ data: 1 });
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
