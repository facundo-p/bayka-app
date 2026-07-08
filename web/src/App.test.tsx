import { screen } from '@testing-library/react';
import { PERFIL_ADMIN, PERFIL_TECNICO, estadoMock, resetEstadoMock } from './test/supabaseMock';
import { renderRutasEn as renderAt } from './test/renderConRutas';

vi.mock('./lib/supabase', async () => {
  const { supabaseMock } = await import('./test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

function simularAdminLogueado() {
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = PERFIL_ADMIN;
}

test('autenticado: muestra el logo de marca y los links de navegación', async () => {
  simularAdminLogueado();
  renderAt('/');
  expect(await screen.findByRole('img', { name: 'Bayka' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Plantaciones' })).toBeInTheDocument();
  // El link de Usuarios es exclusivo del superadmin.
  expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
});

test('autenticado: la ruta raíz redirige al listado de Plantaciones', async () => {
  simularAdminLogueado();
  renderAt('/');
  expect(await screen.findByRole('heading', { name: 'Plantaciones' })).toBeInTheDocument();
  // Sin datos configurados, el listado real muestra su estado vacío.
  expect(await screen.findByText('Sin plantaciones')).toBeInTheDocument();
});

test('autenticado: el footer del sidebar muestra nombre, rol y botón de salir', async () => {
  simularAdminLogueado();
  renderAt('/plantaciones');
  expect(await screen.findByText('Ana Admin')).toBeInTheDocument();
  // El rol se muestra con su etiqueta en español en el footer del sidebar.
  expect(screen.getByText('Administrador')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
});

test('sin sesión: redirige a /login y muestra el formulario', async () => {
  renderAt('/plantaciones');
  expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
});

test('perfil tecnico: muestra la pantalla sin acceso', async () => {
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = PERFIL_TECNICO;
  renderAt('/plantaciones');
  expect(await screen.findByText('Sin acceso')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
});

test('autenticado: /login redirige a Plantaciones', async () => {
  simularAdminLogueado();
  renderAt('/login');
  expect(await screen.findByRole('heading', { name: 'Plantaciones' })).toBeInTheDocument();
});
