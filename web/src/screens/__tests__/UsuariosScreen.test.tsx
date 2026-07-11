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
    email: 'sofia@bayka.org',
    activo: true,
    organizacion_id: 'org-1',
    created_at: '2026-01-10T12:00:00Z',
  },
  {
    id: 'user-2',
    nombre: 'Ana Admin',
    rol: 'admin',
    email: 'ana@bayka.org',
    activo: true,
    organizacion_id: 'org-1',
    created_at: '2026-02-20T12:00:00Z',
  },
  {
    id: 'user-3',
    nombre: 'Teo Técnico',
    rol: 'tecnico',
    email: null,
    activo: false,
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

/** El menú "⋯" de cada fila lleva un aria-label "Cambiar rol de <nombre>". */
function botonesMenu() {
  return screen.getAllByRole('button', { name: /^Cambiar rol de / });
}

/** La tabla de usuarios (el sidebar también muestra al usuario logueado). */
function tablaUsuarios() {
  return within(screen.getByRole('table'));
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
  expect(screen.queryByRole('button', { name: /^Cambiar rol de / })).not.toBeInTheDocument();
});

test('un superadmin ve el link, el subtítulo con conteos y la tabla con roles', async () => {
  configurarUsuariosMock();
  renderRutasEn('/usuarios');

  expect(await screen.findByText('Ana Admin')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Usuarios' })).toBeInTheDocument();
  // Subtítulo computado por rol (1 superadmin, 1 admin, 1 técnico).
  expect(
    screen.getByText('3 personas · 1 superadmin · 1 admin · 1 técnico'),
  ).toBeInTheDocument();
  const tabla = tablaUsuarios();
  expect(tabla.getByText('Teo Técnico')).toBeInTheDocument();
  // Badges de rol con etiqueta en español (dentro de la tabla).
  expect(tabla.getByText('Superadmin')).toBeInTheDocument();
  expect(tabla.getByText('Admin')).toBeInTheDocument();
  expect(tabla.getByText('Técnico')).toBeInTheDocument();
  // Plantaciones: superadmin "Todas"; Ana tiene 2; el resto "Sin plantaciones".
  expect(tabla.getByText('Todas')).toBeInTheDocument();
  expect(tabla.getByText('2 plantaciones')).toBeInTheDocument();
  expect(tabla.getByText('Sin plantaciones')).toBeInTheDocument();
});

test('muestra el email como línea secundaria y cae a la organización si falta', async () => {
  configurarUsuariosMock();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  const tabla = tablaUsuarios();
  expect(tabla.getByText('ana@bayka.org')).toBeInTheDocument();
  // Teo no tiene email (perfil previo al backfill): se ve su organización.
  expect(tabla.getByText('Bayka')).toBeInTheDocument();
});

test('muestra el estado con badge y el filtro por estado compone con el de rol', async () => {
  configurarUsuariosMock();
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  expect(tablaUsuarios().getAllByText('Activo')).toHaveLength(2);
  expect(tablaUsuarios().getByText('Inactivo')).toBeInTheDocument();

  // Inactivos: queda sólo Teo.
  await usuario.click(screen.getByRole('radio', { name: 'Inactivos' }));
  expect(tablaUsuarios().getByText('Teo Técnico')).toBeInTheDocument();
  expect(tablaUsuarios().queryByText('Ana Admin')).not.toBeInTheDocument();

  // Compone con el filtro de rol: Admins + Inactivos = vacío (sin tabla).
  await usuario.click(screen.getByRole('radio', { name: 'Admins' }));
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getByText('No hay usuarios con esos filtros')).toBeInTheDocument();

  // Activos + Admins: vuelven Ana y Sofía.
  await usuario.click(screen.getByRole('radio', { name: 'Activos' }));
  expect(tablaUsuarios().getByText('Ana Admin')).toBeInTheDocument();
  expect(tablaUsuarios().getByText('Sofía Súper')).toBeInTheDocument();
});

test('el filtro Técnicos deja sólo a los técnicos', async () => {
  configurarUsuariosMock();
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  await usuario.click(screen.getByRole('radio', { name: 'Técnicos' }));
  const tabla = tablaUsuarios();
  expect(tabla.getByText('Teo Técnico')).toBeInTheDocument();
  expect(tabla.queryByText('Ana Admin')).not.toBeInTheDocument();
  expect(tabla.queryByText('Sofía Súper')).not.toBeInTheDocument();
});

test('"Agregar usuario" abre un aviso: el alta se hace desde Supabase', async () => {
  configurarUsuariosMock();
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  await usuario.click(screen.getByRole('button', { name: 'Agregar usuario' }));
  const dialogo = screen.getByRole('dialog', { name: 'Agregar usuario' });
  expect(within(dialogo).getByText(/se dan de alta desde el dashboard de Supabase/)).toBeInTheDocument();
});

test('cambiar rol feliz: advierte al promover a superadmin, actualiza e invalida la lista', async () => {
  const consultas = configurarUsuariosMock();
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  // Las filas conservan el orden del fixture: [Sofía, Ana, Teo].
  await usuario.click(botonesMenu()[1]);
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

  const [botonPropio, botonAna] = botonesMenu();
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
      email: 'selva@bayka.org',
      activo: true,
      organizacion_id: 'org-1',
      created_at: '2026-01-10T12:00:00Z',
    },
    USUARIOS[1],
  ]);
  renderRutasEn('/usuarios');
  await screen.findByText('Selva Súper');

  const [botonSelva] = botonesMenu();
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

  await usuario.click(botonesMenu()[1]);
  const dialogo = screen.getByRole('dialog', { name: 'Cambiar rol de Ana Admin' });
  await usuario.selectOptions(within(dialogo).getByLabelText('Nuevo rol'), 'tecnico');
  await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar' }));

  expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
    'Solo un superadmin puede cambiar roles',
  );
});
