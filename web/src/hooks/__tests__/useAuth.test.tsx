import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  PERFIL_ADMIN,
  PERFIL_TECNICO,
  emitirEventoAuth,
  estadoMock,
  prepararSesion,
  prepararSesionAdmin,
  resetEstadoMock,
} from '../../test/supabaseMock';
import { AuthProvider, useAuth } from '../useAuth';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

function renderAuth(queryClient = new QueryClient()) {
  return renderHook(() => useAuth(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    ),
  });
}

const CLAVE = ['plantaciones'];

/** Deja la sesión de user-1 abierta y algo cacheado a su nombre. */
async function loguearConCache(queryClient: QueryClient) {
  estadoMock.perfilFila = PERFIL_ADMIN;
  const { result } = renderAuth(queryClient);
  await waitFor(() => expect(result.current.estado).toBe('anonimo'));
  await act(async () => {
    await result.current.signIn('ana@bayka.com', 'secreta');
  });
  await waitFor(() => expect(result.current.estado).toBe('autenticado'));
  queryClient.setQueryData(CLAVE, [{ id: 'plant-1' }]);
  return result;
}

test('sin sesión queda anonimo', async () => {
  const { result } = renderAuth();
  expect(result.current.estado).toBe('cargando');
  await waitFor(() => expect(result.current.estado).toBe('anonimo'));
  expect(result.current.perfil).toBeNull();
});

test('signIn ok con perfil admin pasa a autenticado', async () => {
  estadoMock.perfilFila = PERFIL_ADMIN;
  const { result } = renderAuth();
  await waitFor(() => expect(result.current.estado).toBe('anonimo'));

  let respuesta: { error: string | null } | undefined;
  await act(async () => {
    respuesta = await result.current.signIn('ana@bayka.com', 'secreta');
  });

  expect(respuesta?.error).toBeNull();
  await waitFor(() => expect(result.current.estado).toBe('autenticado'));
  expect(result.current.perfil).toEqual({
    id: 'user-1',
    nombre: 'Ana Admin',
    rol: 'admin',
    activo: true,
    organizacionId: 'org-1',
  });
});

test('sesión con perfil tecnico pasa a sin-acceso', async () => {
  prepararSesion(PERFIL_TECNICO);
  const { result } = renderAuth();
  await waitFor(() => expect(result.current.estado).toBe('sin-acceso'));
});

test('error de red al cargar el perfil pasa a sin-acceso sin romper', async () => {
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.errorPerfil = { message: 'fetch failed' };
  const { result } = renderAuth();
  await waitFor(() => expect(result.current.estado).toBe('sin-acceso'));
  expect(result.current.perfil).toBeNull();
});

test('un admin dado de baja (activo=false) queda sin-acceso', async () => {
  prepararSesion({ ...PERFIL_ADMIN, activo: false });
  const { result } = renderAuth();
  await waitFor(() => expect(result.current.estado).toBe('sin-acceso'));
});

test('signIn con credenciales malas devuelve mensaje legible', async () => {
  estadoMock.errorSignIn = { message: 'Invalid login credentials' };
  const { result } = renderAuth();
  await waitFor(() => expect(result.current.estado).toBe('anonimo'));

  let respuesta: { error: string | null } | undefined;
  await act(async () => {
    respuesta = await result.current.signIn('ana@bayka.com', 'mala');
  });
  expect(respuesta?.error).toBe('Credenciales inválidas');
});

test('signOut vuelve a anonimo y limpia el perfil', async () => {
  prepararSesionAdmin();
  const { result } = renderAuth();
  await waitFor(() => expect(result.current.estado).toBe('autenticado'));

  await act(async () => {
    await result.current.signOut();
  });
  await waitFor(() => expect(result.current.estado).toBe('anonimo'));
  expect(result.current.perfil).toBeNull();
});

test('cerrar sesión descarta la cache: el usuario siguiente no ve datos del anterior', async () => {
  const queryClient = new QueryClient();
  const result = await loguearConCache(queryClient);

  await act(async () => {
    await result.current.signOut();
  });

  expect(queryClient.getQueryData(CLAVE)).toBeUndefined();
});

test('un refresh de token del mismo usuario no descarta la cache', async () => {
  const queryClient = new QueryClient();
  const result = await loguearConCache(queryClient);

  await act(async () => {
    emitirEventoAuth('TOKEN_REFRESHED');
  });

  await waitFor(() => expect(result.current.estado).toBe('autenticado'));
  expect(queryClient.getQueryData(CLAVE)).toEqual([{ id: 'plant-1' }]);
});
