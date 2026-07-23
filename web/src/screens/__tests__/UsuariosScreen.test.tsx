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

/** El menú "⋯" de cada fila lleva un aria-label "Acciones de <nombre>". */
async function abrirMenu(usuario: ReturnType<typeof userEvent.setup>, nombre: string) {
  await usuario.click(screen.getByRole('button', { name: `Acciones de ${nombre}` }));
  return within(screen.getByRole('menu', { name: `Acciones de ${nombre}` }));
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
  expect(screen.queryByRole('button', { name: /^Acciones de / })).not.toBeInTheDocument();
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

test('"Agregar usuario" invita por email con el rol elegido y refresca el listado', async () => {
  const consultas = configurarUsuariosMock();
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  await usuario.click(screen.getByRole('button', { name: 'Agregar usuario' }));
  const dialogo = screen.getByRole('dialog', { name: 'Agregar usuario' });

  // Sin datos válidos no se puede enviar.
  const enviar = within(dialogo).getByRole('button', { name: 'Enviar invitación' });
  expect(enviar).toBeDisabled();
  await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Nueva Persona');
  await usuario.type(within(dialogo).getByLabelText('Email'), 'no-es-email');
  expect(enviar).toBeDisabled();
  await usuario.clear(within(dialogo).getByLabelText('Email'));
  await usuario.type(within(dialogo).getByLabelText('Email'), 'nueva@bayka.org');
  expect(within(dialogo).getByText(/email para definir su contraseña/)).toBeInTheDocument();

  await usuario.click(enviar);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  expect(estadoMock.invocaciones).toEqual([
    {
      funcion: 'admin-users',
      cuerpo: { accion: 'crear', nombre: 'Nueva Persona', email: 'nueva@bayka.org', rol: 'tecnico' },
    },
  ]);
  // La invalidación vuelve a pedir el listado de perfiles.
  const listados = consultas.filter(
    (consulta) => consulta.tabla === 'profiles' && consulta.operacion === 'select',
  );
  expect(listados.length).toBeGreaterThan(1);
});

test('al promover a superadmin desde el alta se muestra la advertencia', async () => {
  configurarUsuariosMock();
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  await usuario.click(screen.getByRole('button', { name: 'Agregar usuario' }));
  const dialogo = screen.getByRole('dialog', { name: 'Agregar usuario' });
  await usuario.selectOptions(within(dialogo).getByLabelText('Rol'), 'superadmin');
  expect(within(dialogo).getByRole('status')).toHaveTextContent(
    'acceso total, incluida la gestión de usuarios',
  );
});

test('un error del alta (email duplicado) se muestra en el modal', async () => {
  configurarUsuariosMock();
  estadoMock.respuestaInvoke = {
    data: { ok: false, error: 'Ya existe un usuario con ese email' },
    error: null,
  };
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  await usuario.click(screen.getByRole('button', { name: 'Agregar usuario' }));
  const dialogo = screen.getByRole('dialog', { name: 'Agregar usuario' });
  await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Dup');
  await usuario.type(within(dialogo).getByLabelText('Email'), 'dup@bayka.org');
  await usuario.click(within(dialogo).getByRole('button', { name: 'Enviar invitación' }));

  expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
    'Ya existe un usuario con ese email',
  );
});

test('editar rol: advierte al promover a superadmin, actualiza e invalida la lista', async () => {
  const consultas = configurarUsuariosMock();
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  const menu = await abrirMenu(usuario, 'Ana Admin');
  await usuario.click(menu.getByRole('menuitem', { name: 'Editar' }));
  const dialogo = screen.getByRole('dialog', { name: 'Editar a Ana Admin' });

  // Sin cambios no hay nada que guardar.
  expect(within(dialogo).getByRole('button', { name: 'Guardar' })).toBeDisabled();
  await usuario.selectOptions(within(dialogo).getByLabelText('Rol'), 'superadmin');
  expect(within(dialogo).getByRole('status')).toHaveTextContent(
    'acceso total, incluida la gestión de usuarios',
  );

  await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
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

test('el superadmin no puede cambiar su propio rol, pero sí su nombre', async () => {
  configurarUsuariosMock();
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  const menuPropio = await abrirMenu(usuario, 'Sofía Súper');
  await usuario.click(menuPropio.getByRole('menuitem', { name: 'Editar' }));
  const dialogo = screen.getByRole('dialog', { name: 'Editar a Sofía Súper' });

  const selectRol = within(dialogo).getByLabelText('Rol');
  expect(selectRol).toBeDisabled();
  expect(selectRol).toHaveAttribute(
    'title',
    expect.stringContaining('no puede degradarse a sí mismo'),
  );
  // Los otros campos siguen editables.
  expect(within(dialogo).getByLabelText('Nombre')).toBeEnabled();
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
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Selva Súper');

  const menuSelva = await abrirMenu(usuario, 'Selva Súper');
  await usuario.click(menuSelva.getByRole('menuitem', { name: 'Editar' }));
  const dialogo = screen.getByRole('dialog', { name: 'Editar a Selva Súper' });
  const selectRol = within(dialogo).getByLabelText('Rol');
  expect(selectRol).toBeDisabled();
  expect(selectRol).toHaveAttribute(
    'title',
    'Único superadmin: promové otro antes de degradarlo',
  );
});

test('un error del trigger del server se muestra legible en el modal', async () => {
  configurarUsuariosMock(USUARIOS, 'Solo un superadmin puede cambiar roles');
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  const menu = await abrirMenu(usuario, 'Ana Admin');
  await usuario.click(menu.getByRole('menuitem', { name: 'Editar' }));
  const dialogo = screen.getByRole('dialog', { name: 'Editar a Ana Admin' });
  await usuario.selectOptions(within(dialogo).getByLabelText('Rol'), 'tecnico');
  await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

  expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
    'Solo un superadmin puede cambiar roles',
  );
});

test('editar guarda el nombre directo y el email vía la edge function', async () => {
  const consultas = configurarUsuariosMock();
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  const menu = await abrirMenu(usuario, 'Ana Admin');
  await usuario.click(menu.getByRole('menuitem', { name: 'Editar' }));
  const dialogo = screen.getByRole('dialog', { name: 'Editar a Ana Admin' });

  const inputNombre = within(dialogo).getByLabelText('Nombre');
  await usuario.clear(inputNombre);
  await usuario.type(inputNombre, 'Ana Actualizada');
  const inputEmail = within(dialogo).getByLabelText('Email');
  await usuario.clear(inputEmail);
  await usuario.type(inputEmail, 'ana.nueva@bayka.org');
  await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  const update = consultas.find(
    (consulta) => consulta.tabla === 'profiles' && consulta.operacion === 'update',
  );
  expect(update?.payload).toEqual({ nombre: 'Ana Actualizada' });
  expect(update?.filtros).toEqual([{ metodo: 'eq', columna: 'id', valor: 'user-2' }]);
  expect(estadoMock.invocaciones).toEqual([
    {
      funcion: 'admin-users',
      cuerpo: { accion: 'cambiarEmail', userId: 'user-2', email: 'ana.nueva@bayka.org' },
    },
  ]);
});

test('editar sin cambios no permite guardar', async () => {
  configurarUsuariosMock();
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  const menu = await abrirMenu(usuario, 'Ana Admin');
  await usuario.click(menu.getByRole('menuitem', { name: 'Editar' }));
  const dialogo = screen.getByRole('dialog', { name: 'Editar a Ana Admin' });
  expect(within(dialogo).getByRole('button', { name: 'Guardar' })).toBeDisabled();
});

test('editar con email fallido igual refresca la lista (invalidación en onSettled)', async () => {
  const consultas = configurarUsuariosMock();
  // La edge function (cambiarEmail) falla; el update de nombre a profiles va OK.
  estadoMock.respuestaInvoke = {
    data: { ok: false, error: 'Ya existe un usuario con ese email' },
    error: null,
  };
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  const menu = await abrirMenu(usuario, 'Ana Admin');
  await usuario.click(menu.getByRole('menuitem', { name: 'Editar' }));
  const dialogo = screen.getByRole('dialog', { name: 'Editar a Ana Admin' });
  await usuario.clear(within(dialogo).getByLabelText('Nombre'));
  await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Ana Nueva');
  await usuario.clear(within(dialogo).getByLabelText('Email'));
  await usuario.type(within(dialogo).getByLabelText('Email'), 'dup@bayka.org');
  await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

  // El error se muestra y el modal queda abierto...
  expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
    'Ya existe un usuario con ese email',
  );
  // ...pero la lista se invalidó igual (el nombre sí se guardó).
  await waitFor(() => {
    const listados = consultas.filter(
      (consulta) => consulta.tabla === 'profiles' && consulta.operacion === 'select',
    );
    expect(listados.length).toBeGreaterThan(1);
  });
});

test('cambiar contraseña valida y llama a la edge function', async () => {
  configurarUsuariosMock();
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  const menu = await abrirMenu(usuario, 'Ana Admin');
  await usuario.click(menu.getByRole('menuitem', { name: 'Cambiar contraseña' }));
  const dialogo = screen.getByRole('dialog', { name: 'Cambiar contraseña de Ana Admin' });

  await usuario.type(within(dialogo).getByLabelText('Contraseña nueva'), 'segura123');
  await usuario.type(within(dialogo).getByLabelText('Repetir contraseña'), 'distinta123');
  await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar contraseña' }));
  expect(within(dialogo).getByRole('alert')).toHaveTextContent('Las contraseñas no coinciden');
  expect(estadoMock.invocaciones).toEqual([]);

  await usuario.clear(within(dialogo).getByLabelText('Repetir contraseña'));
  await usuario.type(within(dialogo).getByLabelText('Repetir contraseña'), 'segura123');
  await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar contraseña' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  expect(estadoMock.invocaciones).toEqual([
    {
      funcion: 'admin-users',
      cuerpo: { accion: 'cambiarPassword', userId: 'user-2', password: 'segura123' },
    },
  ]);
});

test('cambiar la contraseña de OTRO superadmin está deshabilitado (la propia no)', async () => {
  configurarUsuariosMock([
    USUARIOS[0],
    { ...USUARIOS[1], id: 'user-8', nombre: 'Otra Súper', rol: 'superadmin' },
  ]);
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Otra Súper');

  const menuOtra = await abrirMenu(usuario, 'Otra Súper');
  const itemOtra = menuOtra.getByRole('menuitem', { name: 'Cambiar contraseña' });
  expect(itemOtra).toBeDisabled();
  expect(itemOtra).toHaveAttribute(
    'title',
    'No podés cambiar la contraseña de otro superadmin',
  );

  const menuPropio = await abrirMenu(usuario, 'Sofía Súper');
  expect(menuPropio.getByRole('menuitem', { name: 'Cambiar contraseña' })).toBeEnabled();
});

test('desactivar pide confirmación explicando efectos y ejecuta', async () => {
  configurarUsuariosMock();
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  const menu = await abrirMenu(usuario, 'Ana Admin');
  await usuario.click(menu.getByRole('menuitem', { name: 'Desactivar' }));
  const dialogo = screen.getByRole('dialog', { name: 'Desactivar a Ana Admin' });
  // §15: qué se pierde (acceso) y qué se conserva (datos de campo).
  expect(within(dialogo).getByText(/va a perder el acceso/)).toBeInTheDocument();
  expect(within(dialogo).getByText(/se conservan/)).toBeInTheDocument();

  await usuario.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(estadoMock.invocaciones).toEqual([
    { funcion: 'admin-users', cuerpo: { accion: 'desactivar', userId: 'user-2' } },
  ]);
});

test('desactivarse a sí mismo está deshabilitado; un inactivo ofrece Reactivar', async () => {
  configurarUsuariosMock();
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  const menuPropio = await abrirMenu(usuario, 'Sofía Súper');
  const itemDesactivar = menuPropio.getByRole('menuitem', { name: 'Desactivar' });
  expect(itemDesactivar).toBeDisabled();
  expect(itemDesactivar).toHaveAttribute(
    'title',
    'Un superadmin no puede desactivarse a sí mismo',
  );

  // Teo está inactivo: su menú ofrece Reactivar (no Desactivar).
  const menuTeo = await abrirMenu(usuario, 'Teo Técnico');
  expect(menuTeo.queryByRole('menuitem', { name: 'Desactivar' })).not.toBeInTheDocument();
  await usuario.click(menuTeo.getByRole('menuitem', { name: 'Reactivar' }));
  const dialogo = screen.getByRole('dialog', { name: 'Reactivar a Teo Técnico' });
  await usuario.click(within(dialogo).getByRole('button', { name: 'Reactivar' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(estadoMock.invocaciones).toEqual([
    { funcion: 'admin-users', cuerpo: { accion: 'reactivar', userId: 'user-3' } },
  ]);
});

test('reenviar invitación: deshabilitada sin email; con email envía y confirma', async () => {
  configurarUsuariosMock();
  const usuario = userEvent.setup();
  renderRutasEn('/usuarios');
  await screen.findByText('Ana Admin');

  // Teo no tiene email registrado.
  const menuTeo = await abrirMenu(usuario, 'Teo Técnico');
  const itemTeo = menuTeo.getByRole('menuitem', { name: 'Reenviar invitación' });
  expect(itemTeo).toBeDisabled();
  expect(itemTeo).toHaveAttribute('title', 'El usuario no tiene email registrado');

  const menuAna = await abrirMenu(usuario, 'Ana Admin');
  await usuario.click(menuAna.getByRole('menuitem', { name: 'Reenviar invitación' }));
  const dialogo = screen.getByRole('dialog', { name: 'Reenviar invitación a Ana Admin' });
  await usuario.click(within(dialogo).getByRole('button', { name: 'Reenviar' }));

  expect(await within(dialogo).findByRole('status')).toHaveTextContent('Invitación enviada.');
  expect(estadoMock.invocaciones).toEqual([
    { funcion: 'admin-users', cuerpo: { accion: 'reenviarInvitacion', email: 'ana@bayka.org' } },
  ]);
});
