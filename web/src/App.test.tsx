import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from './hooks/useAuth';
import { PERFIL_ADMIN, PERFIL_TECNICO, estadoMock, resetEstadoMock } from './test/supabaseMock';
import { AppRoutes } from './App';

vi.mock('./lib/supabase', async () => {
  const { supabaseMock } = await import('./test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function simularAdminLogueado() {
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = PERFIL_ADMIN;
}

test('autenticado: muestra el wordmark BAYKA y los links de navegación', async () => {
  simularAdminLogueado();
  renderAt('/');
  expect(await screen.findByText('BAYKA')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Plantaciones' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Usuarios' })).toBeInTheDocument();
});

test('autenticado: la ruta raíz redirige al placeholder de Plantaciones', async () => {
  simularAdminLogueado();
  renderAt('/');
  expect(await screen.findByRole('heading', { name: 'Plantaciones' })).toBeInTheDocument();
  expect(screen.getByText('Sección en construcción.')).toBeInTheDocument();
});

test('autenticado: el header muestra nombre, rol y botón Salir', async () => {
  simularAdminLogueado();
  renderAt('/plantaciones');
  expect(await screen.findByText('Ana Admin')).toBeInTheDocument();
  expect(screen.getByText('admin')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();
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
