import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import { PG_ERROR } from '../../lib/postgresErrorCodes';
import {
  crearEspecieCientifica,
  editarEspecieCientifica,
  eliminarEspecieCientifica,
  EspecieCientificaEnUsoError,
  NombreCientificoDuplicadoError,
} from '../especieCientificaRepository';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

const ERROR_DUPLICADO = { message: 'duplicate key', code: PG_ERROR.UNIQUE_VIOLATION };
const ERROR_EN_USO = { message: 'violates foreign key', code: PG_ERROR.FOREIGN_KEY_VIOLATION };

test('crear inserta el nombre y devuelve el id', async () => {
  const consultas = capturarConsultas(() => ({ data: { id: 'ec-nueva' } }));

  expect(await crearEspecieCientifica('Prosopis alba')).toBe('ec-nueva');
  expect(consultas[0]).toMatchObject({
    tabla: 'especies_cientificas',
    operacion: 'insert',
    payload: { nombre: 'Prosopis alba' },
  });
});

test('un nombre repetido lanza NombreCientificoDuplicadoError', async () => {
  capturarConsultas(() => ({ error: ERROR_DUPLICADO }));
  await expect(crearEspecieCientifica('Prosopis alba')).rejects.toBeInstanceOf(
    NombreCientificoDuplicadoError,
  );
  await expect(editarEspecieCientifica('ec-1', 'Prosopis alba')).rejects.toBeInstanceOf(
    NombreCientificoDuplicadoError,
  );
});

test('editar actualiza el nombre filtrando por id', async () => {
  const consultas = capturarConsultas(() => ({ data: null }));
  await editarEspecieCientifica('ec-1', 'Prosopis nigra');

  expect(consultas[0]).toMatchObject({
    tabla: 'especies_cientificas',
    operacion: 'update',
    payload: { nombre: 'Prosopis nigra' },
    filtros: [{ metodo: 'eq', columna: 'id', valor: 'ec-1' }],
  });
});

test('eliminar borra por id', async () => {
  const consultas = capturarConsultas(() => ({ data: null }));
  await eliminarEspecieCientifica('ec-1');

  expect(consultas[0]).toMatchObject({
    tabla: 'especies_cientificas',
    operacion: 'delete',
    filtros: [{ metodo: 'eq', columna: 'id', valor: 'ec-1' }],
  });
});

test('eliminar una que agrupa especies lanza EspecieCientificaEnUsoError', async () => {
  capturarConsultas(() => ({ error: ERROR_EN_USO }));
  await expect(eliminarEspecieCientifica('ec-1')).rejects.toBeInstanceOf(
    EspecieCientificaEnUsoError,
  );
});

test('otros errores propagan su mensaje', async () => {
  capturarConsultas(() => ({ error: { message: 'insufficient_privilege' } }));
  await expect(crearEspecieCientifica('Prosopis alba')).rejects.toThrow('insufficient_privilege');
});
