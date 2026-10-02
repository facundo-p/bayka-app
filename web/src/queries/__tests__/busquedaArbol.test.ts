import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import {
  VIGENCIA_CODIGOS_MS,
  listarCodigosPlantacion,
  reiniciarCacheCodigosPlantacion,
} from '../busquedaArbol';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(() => {
  resetEstadoMock();
  reiniciarCacheCodigosPlantacion();
});

afterEach(() => {
  vi.useRealTimers();
});

const CODIGOS = [{ codigo: 'SS26' }, { codigo: 'LM25' }];

test('dos llamadas seguidas consultan plantations una sola vez', async () => {
  const consultas = capturarConsultas(() => ({ data: CODIGOS }));
  expect(await listarCodigosPlantacion()).toEqual(['SS26', 'LM25']);
  expect(await listarCodigosPlantacion()).toEqual(['SS26', 'LM25']);
  expect(consultas).toHaveLength(1);
});

test('dos llamadas simultáneas comparten el request', async () => {
  const consultas = capturarConsultas(() => ({ data: CODIGOS }));
  await Promise.all([listarCodigosPlantacion(), listarCodigosPlantacion()]);
  expect(consultas).toHaveLength(1);
});

test('un error devuelve [] y no se cachea', async () => {
  let falla = true;
  const consultas = capturarConsultas(() =>
    falla ? { error: { message: 'sin red' } } : { data: CODIGOS },
  );
  expect(await listarCodigosPlantacion()).toEqual([]);
  falla = false;
  expect(await listarCodigosPlantacion()).toEqual(['SS26', 'LM25']);
  expect(consultas).toHaveLength(2);
});

test('un data nulo sin error no se cachea como lista vacía', async () => {
  let vacio = true;
  const consultas = capturarConsultas(() => (vacio ? { data: null } : { data: CODIGOS }));
  expect(await listarCodigosPlantacion()).toEqual([]);
  vacio = false;
  expect(await listarCodigosPlantacion()).toEqual(['SS26', 'LM25']);
  expect(consultas).toHaveLength(2);
});

test('vencida la vigencia vuelve a consultar', async () => {
  vi.useFakeTimers();
  const consultas = capturarConsultas(() => ({ data: CODIGOS }));
  await listarCodigosPlantacion();
  vi.advanceTimersByTime(VIGENCIA_CODIGOS_MS + 1);
  await listarCodigosPlantacion();
  expect(consultas).toHaveLength(2);
});

test('reiniciar la caché fuerza otra consulta', async () => {
  const consultas = capturarConsultas(() => ({ data: CODIGOS }));
  await listarCodigosPlantacion();
  reiniciarCacheCodigosPlantacion();
  await listarCodigosPlantacion();
  expect(consultas).toHaveLength(2);
});
