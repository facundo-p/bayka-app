import { act, renderHook, waitFor } from '@testing-library/react';
import {
  PERFIL_ADMIN,
  PERFIL_TECNICO,
  estadoMock,
  resetEstadoMock,
} from '../../test/supabaseMock';
import { AuthProvider, useAuth } from '../useAuth';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider });
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
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = PERFIL_TECNICO;
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
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = { ...PERFIL_ADMIN, activo: false };
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
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = PERFIL_ADMIN;
  const { result } = renderAuth();
  await waitFor(() => expect(result.current.estado).toBe('autenticado'));

  await act(async () => {
    await result.current.signOut();
  });
  await waitFor(() => expect(result.current.estado).toBe('anonimo'));
  expect(result.current.perfil).toBeNull();
});
