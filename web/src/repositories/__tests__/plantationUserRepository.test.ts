import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { PG_ERROR } from '../../lib/postgresErrorCodes';
import {
  asignarUsuario,
  desasignarUsuario,
  MENSAJE_USUARIO_YA_ASIGNADO,
} from '../plantationUserRepository';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

/** Captura todas las consultas y delega la respuesta en `responder`. */
function capturarConsultas(responder: () => RespuestaMock): ConsultaCapturada[] {
  const consultas: ConsultaCapturada[] = [];
  estadoMock.resolverConsulta = (consulta) => {
    consultas.push(consulta);
    return responder();
  };
  return consultas;
}

describe('asignarUsuario', () => {
  test('inserta la asignación con plantación, usuario y rol', async () => {
    const consultas = capturarConsultas(() => ({ data: null }));
    await asignarUsuario('plant-1', 'user-2', 'admin');

    expect(consultas[0].tabla).toBe('plantation_users');
    expect(consultas[0].operacion).toBe('insert');
    expect(consultas[0].payload).toEqual({
      plantation_id: 'plant-1',
      user_id: 'user-2',
      rol_en_plantacion: 'admin',
    });
  });

  test('duplicado (unique_violation) lanza el mensaje para el usuario', async () => {
    capturarConsultas(() => ({
      error: { message: 'duplicate key value violates unique constraint', code: PG_ERROR.UNIQUE_VIOLATION },
    }));
    await expect(asignarUsuario('plant-1', 'user-2', 'tecnico')).rejects.toThrow(
      MENSAJE_USUARIO_YA_ASIGNADO,
    );
  });

  test('otros errores propagan el mensaje original', async () => {
    capturarConsultas(() => ({ error: { message: 'sin permisos' } }));
    await expect(asignarUsuario('plant-1', 'user-2', 'tecnico')).rejects.toThrow('sin permisos');
  });
});

describe('desasignarUsuario', () => {
  test('borra la fila filtrando por plantación y usuario', async () => {
    const consultas = capturarConsultas(() => ({ data: null }));
    await desasignarUsuario('plant-1', 'user-2');

    expect(consultas[0].tabla).toBe('plantation_users');
    expect(consultas[0].operacion).toBe('delete');
    expect(consultas[0].filtros).toEqual([
      { metodo: 'eq', columna: 'plantation_id', valor: 'plant-1' },
      { metodo: 'eq', columna: 'user_id', valor: 'user-2' },
    ]);
  });

  test('propaga el error de Supabase', async () => {
    capturarConsultas(() => ({ error: { message: 'falló la red' } }));
    await expect(desasignarUsuario('plant-1', 'user-2')).rejects.toThrow('falló la red');
  });
});
