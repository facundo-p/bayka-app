import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada } from '../../test/queryBuilderMock';
import { listarAsignados, listarPerfiles } from '../usuarioQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

const FILA_ASIGNADO = {
  user_id: 'user-2',
  rol_en_plantacion: 'tecnico',
  assigned_at: '2026-06-01T12:00:00Z',
  profiles: { nombre: 'Beto Técnico', rol: 'tecnico' },
};

describe('listarPerfiles', () => {
  test('consulta profiles ordenado por nombre y devuelve las filas', async () => {
    const consultas: ConsultaCapturada[] = [];
    estadoMock.resolverConsulta = (consulta) => {
      consultas.push(consulta);
      return { data: [{ id: 'user-1', nombre: 'Ana', rol: 'admin' }], error: null };
    };
    const perfiles = await listarPerfiles();

    expect(perfiles).toEqual([{ id: 'user-1', nombre: 'Ana', rol: 'admin' }]);
    expect(consultas[0].tabla).toBe('profiles');
    expect(consultas[0].orden).toEqual({ columna: 'nombre', ascending: true });
  });

  test('propaga el error de Supabase', async () => {
    estadoMock.resolverConsulta = () => ({ data: null, error: { message: 'sin permisos' } });
    await expect(listarPerfiles()).rejects.toThrow('sin permisos');
  });
});

describe('listarAsignados', () => {
  test('mapea el join plantation_users + profiles a camelCase', async () => {
    estadoMock.resolverConsulta = () => ({ data: [FILA_ASIGNADO], error: null });
    const asignados = await listarAsignados('plant-1');

    expect(asignados).toEqual([
      {
        userId: 'user-2',
        nombre: 'Beto Técnico',
        rolGlobal: 'tecnico',
        rolEnPlantacion: 'tecnico',
        assignedAt: '2026-06-01T12:00:00Z',
      },
    ]);
  });

  test('sin perfil embebido usa nombre vacío y rol global tecnico', async () => {
    estadoMock.resolverConsulta = () => ({
      data: [{ ...FILA_ASIGNADO, profiles: null }],
      error: null,
    });
    const [asignado] = await listarAsignados('plant-1');
    expect(asignado.nombre).toBe('');
    expect(asignado.rolGlobal).toBe('tecnico');
  });

  test('filtra por plantación y ordena por fecha de asignación', async () => {
    const consultas: ConsultaCapturada[] = [];
    estadoMock.resolverConsulta = (consulta) => {
      consultas.push(consulta);
      return { data: [], error: null };
    };
    await listarAsignados('plant-1');

    expect(consultas[0].tabla).toBe('plantation_users');
    expect(consultas[0].filtros).toEqual([
      { metodo: 'eq', columna: 'plantation_id', valor: 'plant-1' },
    ]);
    expect(consultas[0].orden).toEqual({ columna: 'assigned_at', ascending: true });
  });

  test('propaga el error de Supabase', async () => {
    estadoMock.resolverConsulta = () => ({ data: null, error: { message: 'falló la red' } });
    await expect(listarAsignados('plant-1')).rejects.toThrow('falló la red');
  });
});
