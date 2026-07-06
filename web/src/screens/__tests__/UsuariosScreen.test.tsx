import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  PERFIL_ADMIN,
  PERFIL_SUPERADMIN,
  estadoMock,
  resetEstadoMock,
} from '../../test/supabaseMock';
import type { ConsultaCapturada } from '../../test/queryBuilderMock';
import { renderRutasEn } from '../../test/renderConRutas';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(() => {
  resetEstadoMock();
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = PERFIL_SUPERADMIN;
});

const USUARIOS = [
  {
    id: 'user-1',
    nombre: 'Sofía Súper',
    rol: 'superadmin',
    organizacion_id: 'org-1',
    created_at: '2026-01-10T12:00:00Z',
  },
  {
    id: 'user-2',
    nombre: 'Ana Admin',
    rol: 'admin',
    organizacion_id: 'org-1',
    created_at: '2026-02-20T12:00:00Z',
  },
  {
    id: 'user-3',
    nombre: 'Teo Técnico',
    rol: 'tecnico',
    organizacion_id: 'org-1',
    created_at: '2026-03-30T12:00:00Z',
  },
];

/** Resuelve las tres tablas de la pantalla y captura todas las consultas. */
function configurarUsuariosMock(usuarios = USUARIOS, errorUpdate?: string): ConsultaCapturada[] {
  const consultas: ConsultaCapturada[] = [];
  estadoMock.resolverConsulta = (consulta) => {
    consultas.push(consulta);
    if (consulta.tabla === 'profiles' && consulta.operacion === 'update') {
      return errorUpdate ? { data: null, error: { message: errorUpdate } } : { data: null };
    }
    if (consulta.tabla === 'profiles') return { data: usuarios, error: null };
    if (consulta.tabla === 'plantation_users') {
      return { data: [{ user_id: 'user-2' }, { user_id: 'user-2' }], error: null };
    }
    if (consulta.tabla === 'organizations') {
      return { data: [{ id: 'org-1', nombre: 'Bayka' }], error: null };
    }
    return { data: [], error: null };
  };
  return consultas;
}

test('un admin no ve el link Usuarios y la sección le muestra el aviso de superadmin', async () => {
  estadoMock.perfilFila = PERFIL_ADMIN;
  configurarUsuariosMock();
  renderRutasEn('/usuarios');

  expect(
    await screen.findByText('Sección solo para superadministradores'),
  ).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ir a Plantaciones' })).toBeInTheDocument();
  // No hay tabla: la pantalla de usuarios no se montó.
  expect(screen.queryByText('Teo Técnico')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cambiar rol' })).not.toBeInTheDocument();
});

test('un superadmin ve el link, la nota de alta y la tabla con datos', async () => {
  configurarUsuariosMock();
  renderRutasEn('/usuarios');

  expect(await screen.findByText('Ana Admin')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Usuarios' })).toBeInTheDocument();
  expect(
    screen.getByText('El alta de usuarios se hace desde el dashboard de Supabase.'),
  ).toBeInTheDocument();
  expect(screen.getByText('Teo Técnico')).toBeInTheDocument();
  // Organización resuelta por id y fecha de alta corta.
  expect(screen.getAllByText('Bayka')).toHaveLength(3);
  expect(screen.getByText('20/02/2026')).toBeInTheDocument();
  // Ana tiene 2 plantaciones asignadas; el resto 0.
  expect(screen.getByText('2')).toBeInTheDocument();
  expect(screen.getAllByText('0')).toHaveLength(2);
});

test('cambiar rol feliz: advierte al promover a superadmin, actualiza e invalida la lista', async () => {
  const consultas = configurarUsuariosMock();
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  // Las filas conservan el orden del fixture: [Sofía, Ana, Teo].
  const botones = screen.getAllByRole('button', { name: 'Cambiar rol' });
  await usuario.click(botones[1]);
  const dialogo = screen.getByRole('dialog', { name: 'Cambiar rol de Ana Admin' });

  // Sin cambio de rol no hay nada que confirmar.
  expect(within(dialogo).getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  await usuario.selectOptions(within(dialogo).getByLabelText('Nuevo rol'), 'superadmin');
  expect(within(dialogo).getByRole('status')).toHaveTextContent(
    'acceso total, incluida la gestión de usuarios',
  );

  await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  const update = consultas.find((consulta) => consulta.operacion === 'update');
  expect(update?.tabla).toBe('profiles');
  expect(update?.payload).toEqual({ rol: 'superadmin' });
  expect(update?.filtros).toEqual([{ metodo: 'eq', columna: 'id', valor: 'user-2' }]);

  // La invalidación vuelve a pedir el listado de perfiles.
  const listados = consultas.filter(
    (consulta) => consulta.tabla === 'profiles' && consulta.operacion === 'select',
  );
  expect(listados.length).toBeGreaterThan(1);
});

test('la acción está deshabilitada para la propia fila del superadmin', async () => {
  configurarUsuariosMock();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  const [botonPropio, botonAna] = screen.getAllByRole('button', { name: 'Cambiar rol' });
  expect(botonPropio).toBeDisabled();
  expect(botonPropio).toHaveAttribute(
    'title',
    expect.stringContaining('no puede degradarse a sí mismo'),
  );
  expect(botonAna).toBeEnabled();
});

test('el único superadmin del sistema no es degradable', async () => {
  configurarUsuariosMock([
    {
      id: 'user-9',
      nombre: 'Selva Súper',
      rol: 'superadmin',
      organizacion_id: 'org-1',
      created_at: '2026-01-10T12:00:00Z',
    },
    USUARIOS[1],
  ]);
  renderRutasEn('/usuarios');
  await screen.findByText('Selva Súper');

  const [botonSelva] = screen.getAllByRole('button', { name: 'Cambiar rol' });
  expect(botonSelva).toBeDisabled();
  expect(botonSelva).toHaveAttribute(
    'title',
    'Único superadmin: promové otro antes de degradarlo',
  );
});

test('un error del trigger del server se muestra legible en el modal', async () => {
  configurarUsuariosMock(USUARIOS, 'Solo un superadmin puede cambiar roles');
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  const botones = screen.getAllByRole('button', { name: 'Cambiar rol' });
  await usuario.click(botones[1]);
  const dialogo = screen.getByRole('dialog', { name: 'Cambiar rol de Ana Admin' });
  await usuario.selectOptions(within(dialogo).getByLabelText('Nuevo rol'), 'tecnico');
  await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar' }));

  expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
    'Solo un superadmin puede cambiar roles',
  );
});
