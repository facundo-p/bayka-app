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
      return { data: [{ id: 'user-1', nombre: 'Ana', rol: 'admin', activo: true }], error: null };
    };
    const perfiles = await listarPerfiles();

    expect(perfiles).toEqual([{ id: 'user-1', nombre: 'Ana', rol: 'admin', activo: true }]);
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
    { id: 'user-1', nombre: 'Ana', rol: 'admin', email: 'ana@bayka.org', activo: true, organizacion_id: 'org-1', created_at: '2026-01-10T12:00:00Z' },
    { id: 'user-2', nombre: 'Beto', rol: 'tecnico', email: null, activo: false, organizacion_id: 'org-2', created_at: '2026-02-20T12:00:00Z' },
    { id: 'user-3', nombre: 'Cami', rol: 'superadmin', email: 'cami@bayka.org', activo: true, organizacion_id: null, created_at: '2026-03-30T12:00:00Z' },
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

  test('mapea rol, email, estado, organización y fecha de alta a camelCase', async () => {
    configurarTablas();
    const [ana, beto] = await listarUsuariosConAsignaciones();

    expect(ana).toEqual({
      id: 'user-1',
      nombre: 'Ana',
      rol: 'admin',
      email: 'ana@bayka.org',
      activo: true,
      organizacionId: 'org-1',
      organizacionNombre: 'Bayka',
      plantacionesAsignadas: 2,
      createdAt: '2026-01-10T12:00:00Z',
    });
    // Perfil previo al backfill (email null) y desactivado.
    expect(beto.email).toBeNull();
    expect(beto.activo).toBe(false);
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

  test('cuenta asignaciones por usuario sin truncar a 1000 (pagina con range)', async () => {
    const totalFilas = 1500;
    const rangos: Array<{ desde: number; hasta: number }> = [];
    estadoMock.resolverConsulta = (consulta) => {
      if (consulta.tabla === 'profiles') return { data: [FILAS_PERFILES[0]], error: null };
      if (consulta.tabla === 'plantation_users') {
        const { desde, hasta } = consulta.rango ?? { desde: 0, hasta: totalFilas - 1 };
        rangos.push({ desde, hasta });
        const filas: Array<{ user_id: string }> = [];
        for (let indice = desde; indice <= hasta && indice < totalFilas; indice++) {
          filas.push({ user_id: 'user-1' });
        }
        return { data: filas, error: null };
      }
      return { data: [], error: null };
    };

    const usuarios = await listarUsuariosConAsignaciones();

    expect(usuarios[0].plantacionesAsignadas).toBe(totalFilas);
    // Página 0 llena (1000) + página 1 parcial (500) → dos viajes, sin truncar.
    expect(rangos).toEqual([
      { desde: 0, hasta: 999 },
      { desde: 1000, hasta: 1999 },
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

  test('filtra por plantación y solo técnicos, ordena por fecha de asignación', async () => {
    const consultas: ConsultaCapturada[] = [];
    estadoMock.resolverConsulta = (consulta) => {
      consultas.push(consulta);
      return { data: [], error: null };
    };
    await listarAsignados('plant-1');

    expect(consultas[0].tabla).toBe('plantation_users');
    // Issue #67: excluye las membresías 'admin' automáticas (migración 028).
    expect(consultas[0].filtros).toEqual([
      { metodo: 'eq', columna: 'plantation_id', valor: 'plant-1' },
      { metodo: 'eq', columna: 'rol_en_plantacion', valor: 'tecnico' },
    ]);
    expect(consultas[0].orden).toEqual({ columna: 'assigned_at', ascending: true });
  });

  test('propaga el error de Supabase', async () => {
    estadoMock.resolverConsulta = () => ({ data: null, error: { message: 'falló la red' } });
    await expect(listarAsignados('plant-1')).rejects.toThrow('falló la red');
  });
});
