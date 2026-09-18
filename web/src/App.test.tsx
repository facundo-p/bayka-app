import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  PERFIL_ADMIN,
  PERFIL_TECNICO,
  prepararSesion,
  prepararSesionAdmin,
  resetEstadoMock,
} from './test/supabaseMock';
import { renderRutasEn as renderAt } from './test/renderConRutas';
import { capturarConsultas } from './test/capturarConsultas';

vi.mock('./lib/supabase', async () => {
  const { supabaseMock } = await import('./test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

test('autenticado: muestra el logo de marca y los links de navegación', async () => {
  prepararSesionAdmin();
  renderAt('/');
  expect(await screen.findByRole('img', { name: 'Bayka' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Plantaciones' })).toBeInTheDocument();
  // El link de Usuarios es exclusivo del superadmin.
  expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
});

test('autenticado: la ruta raíz redirige al listado de Plantaciones', async () => {
  prepararSesionAdmin();
  renderAt('/');
  expect(await screen.findByRole('heading', { name: 'Plantaciones' })).toBeInTheDocument();
  // Sin datos configurados, el listado real muestra su estado vacío.
  expect(await screen.findByText('Sin plantaciones')).toBeInTheDocument();
});

test('autenticado: el footer del sidebar muestra nombre y rol, y la cuenta es el botón', async () => {
  prepararSesionAdmin();
  renderAt('/plantaciones');
  expect(await screen.findByText('Ana Admin')).toBeInTheDocument();
  // El rol se muestra con su etiqueta en español en el footer del sidebar.
  expect(screen.getByText('Administrador')).toBeInTheDocument();
  // Nombre y rol son el nombre accesible del botón que abre la confirmación.
  expect(screen.getByRole('button', { name: 'Ana Admin Administrador' })).toHaveAttribute(
    'aria-haspopup',
    'dialog',
  );
});

test('cerrar sesión pregunta antes, y cancelar deja la sesión abierta', async () => {
  prepararSesionAdmin();
  renderAt('/plantaciones');
  const usuario = userEvent.setup();

  await usuario.click(await screen.findByRole('button', { name: 'Ana Admin Administrador' }));
  const dialogo = screen.getByRole('dialog', { name: '¿Cerrar sesión?' });
  expect(within(dialogo).getByText('Estás como Ana Admin, Administrador.')).toBeInTheDocument();

  await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('Ana Admin')).toBeInTheDocument();
});

test('cerrar sesión: al confirmar, termina la sesión y vuelve al login', async () => {
  prepararSesionAdmin();
  renderAt('/plantaciones');
  const usuario = userEvent.setup();

  await usuario.click(await screen.findByRole('button', { name: 'Ana Admin Administrador' }));
  const dialogo = screen.getByRole('dialog', { name: '¿Cerrar sesión?' });
  await usuario.click(within(dialogo).getByRole('button', { name: 'Cerrar sesión' }));

  expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
});

test('autenticado sin nombre: el footer muestra el id corto en vez de quedar vacío', async () => {
  prepararSesion({ ...PERFIL_ADMIN, id: 'abcdefgh-1234', nombre: '   ' });
  renderAt('/plantaciones');
  expect(await screen.findByText('abcdefgh')).toBeInTheDocument();
  expect(screen.getByText('Administrador')).toBeInTheDocument();
});

test('sin sesión: redirige a /login y muestra el formulario', async () => {
  renderAt('/plantaciones');
  expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
});

test('perfil tecnico: muestra la pantalla sin acceso', async () => {
  prepararSesion(PERFIL_TECNICO);
  renderAt('/plantaciones');
  expect(await screen.findByText('Sin acceso')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
});

test('autenticado: /login redirige a Plantaciones', async () => {
  prepararSesionAdmin();
  renderAt('/login');
  expect(await screen.findByRole('heading', { name: 'Plantaciones' })).toBeInTheDocument();
});

test('sin sesión: no se consultan plantaciones (cachearía vacío y lo vería el login)', async () => {
  const consultas = capturarConsultas(() => ({ data: [] }));
  renderAt('/login');
  expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  expect(consultas.filter((consulta) => consulta.tabla === 'plantations')).toEqual([]);
});
