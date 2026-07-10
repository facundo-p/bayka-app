import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import {
  MENSAJE_ADMIN_USERS_GENERICO,
  cambiarEmail,
  cambiarPassword,
  crearUsuario,
  desactivarUsuario,
  reactivarUsuario,
  reenviarInvitacion,
} from '../adminUsersService';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

test.each([
  [
    'crearUsuario',
    () => crearUsuario({ nombre: 'Nueva', email: 'nueva@bayka.org', rol: 'tecnico' }),
    { accion: 'crear', nombre: 'Nueva', email: 'nueva@bayka.org', rol: 'tecnico' },
  ],
  [
    'reenviarInvitacion',
    () => reenviarInvitacion('teo@bayka.org'),
    { accion: 'reenviarInvitacion', email: 'teo@bayka.org' },
  ],
  ['desactivarUsuario', () => desactivarUsuario('user-3'), { accion: 'desactivar', userId: 'user-3' }],
  ['reactivarUsuario', () => reactivarUsuario('user-3'), { accion: 'reactivar', userId: 'user-3' }],
  [
    'cambiarPassword',
    () => cambiarPassword('user-3', 'segura123'),
    { accion: 'cambiarPassword', userId: 'user-3', password: 'segura123' },
  ],
  [
    'cambiarEmail',
    () => cambiarEmail('user-3', 'nuevo@bayka.org'),
    { accion: 'cambiarEmail', userId: 'user-3', email: 'nuevo@bayka.org' },
  ],
])('%s invoca admin-users con el payload del contrato', async (_nombre, ejecutar, cuerpo) => {
  await ejecutar();
  expect(estadoMock.invocaciones).toEqual([{ funcion: 'admin-users', cuerpo }]);
});

test('un error del contrato en data se lanza con su mensaje', async () => {
  estadoMock.respuestaInvoke = {
    data: { ok: false, error: 'Ya existe un usuario con ese email' },
    error: null,
  };
  await expect(
    crearUsuario({ nombre: 'Nueva', email: 'dup@bayka.org', rol: 'tecnico' }),
  ).rejects.toThrow('Ya existe un usuario con ese email');
});

test('un error HTTP con cuerpo del contrato usa el mensaje del server', async () => {
  estadoMock.respuestaInvoke = {
    data: null,
    error: {
      context: { json: async () => ({ ok: false, error: 'Usuario inexistente' }) },
    },
  };
  await expect(desactivarUsuario('nope')).rejects.toThrow('Usuario inexistente');
});

test('una falla de red sin cuerpo interpretable usa el mensaje genérico', async () => {
  estadoMock.respuestaInvoke = { data: null, error: { message: 'fetch failed' } };
  await expect(reenviarInvitacion('teo@bayka.org')).rejects.toThrow(
    MENSAJE_ADMIN_USERS_GENERICO,
  );
});
