import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada } from '../../test/queryBuilderMock';
import {
  listarAsignados,
  listarPerfiles,
  listarUsuariosConAsignaciones,
} from '../usuarioQueries';

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

describe('listarUsuariosConAsignaciones', () => {
  const FILAS_PERFILES = [
    { id: 'user-1', nombre: 'Ana', rol: 'admin', organizacion_id: 'org-1', created_at: '2026-01-10T12:00:00Z' },
    { id: 'user-2', nombre: 'Beto', rol: 'tecnico', organizacion_id: 'org-2', created_at: '2026-02-20T12:00:00Z' },
    { id: 'user-3', nombre: 'Cami', rol: 'superadmin', organizacion_id: null, created_at: '2026-03-30T12:00:00Z' },
  ];

  function configurarTablas() {
    estadoMock.resolverConsulta = (consulta) => {
      if (consulta.tabla === 'profiles') return { data: FILAS_PERFILES, error: null };
      if (consulta.tabla === 'plantation_users') {
        return {
          data: [{ user_id: 'user-1' }, { user_id: 'user-1' }, { user_id: 'user-2' }],
          error: null,
        };
      }
      if (consulta.tabla === 'organizations') {
        return { data: [{ id: 'org-1', nombre: 'Bayka' }], error: null };
      }
      return { data: [], error: null };
    };
  }

  test('agrega el count de asignaciones por usuario con un Map en cliente', async () => {
    configurarTablas();
    const usuarios = await listarUsuariosConAsignaciones();

    expect(usuarios.map((usuario) => usuario.plantacionesAsignadas)).toEqual([2, 1, 0]);
  });

  test('resuelve el nombre de organización y deja vacío si no se encuentra', async () => {
    configurarTablas();
    const [ana, beto, cami] = await listarUsuariosConAsignaciones();

    expect(ana.organizacionNombre).toBe('Bayka');
    // org-2 no está en organizations (RLS u org borrada): nombre vacío.
    expect(beto.organizacionNombre).toBe('');
    // Sin organizacion_id tampoco hay nombre.
    expect(cami.organizacionNombre).toBe('');
  });

  test('mapea rol, organización y fecha de alta a camelCase', async () => {
    configurarTablas();
    const [ana] = await listarUsuariosConAsignaciones();

    expect(ana).toEqual({
      id: 'user-1',
      nombre: 'Ana',
      rol: 'admin',
      organizacionId: 'org-1',
      organizacionNombre: 'Bayka',
      plantacionesAsignadas: 2,
      createdAt: '2026-01-10T12:00:00Z',
    });
  });

  test('consulta profiles ordenado por nombre', async () => {
    const consultas: ConsultaCapturada[] = [];
    estadoMock.resolverConsulta = (consulta) => {
      consultas.push(consulta);
      return { data: [], error: null };
    };
    await listarUsuariosConAsignaciones();

    const perfiles = consultas.find((consulta) => consulta.tabla === 'profiles');
    expect(perfiles?.orden).toEqual({ columna: 'nombre', ascending: true });
    expect(consultas.map((consulta) => consulta.tabla).sort()).toEqual([
      'organizations',
      'plantation_users',
      'profiles',
    ]);
  });

  test('propaga el error de cualquiera de las tablas', async () => {
    estadoMock.resolverConsulta = (consulta) =>
      consulta.tabla === 'plantation_users'
        ? { data: null, error: { message: 'sin permisos' } }
        : { data: [], error: null };
    await expect(listarUsuariosConAsignaciones()).rejects.toThrow('sin permisos');
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
