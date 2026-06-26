import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada } from '../../test/queryBuilderMock';
import { idsGenerados } from '../idsQueries';

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
