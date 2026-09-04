import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import { supabase } from '../../lib/supabase';
import {
  actualizarPasswordUsuario,
  obtenerSesionActual,
  suscribirseACambiosDeSesion,
} from '../authService';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

describe('obtenerSesionActual', () => {
  test('devuelve null sin sesión', async () => {
    expect(await obtenerSesionActual()).toBeNull();
  });

  test('devuelve la sesión activa', async () => {
    estadoMock.sesion = { user: { id: 'user-1' } };
    expect(await obtenerSesionActual()).toEqual(estadoMock.sesion);
  });
});

describe('suscribirseACambiosDeSesion', () => {
  test('notifica la sesión en cada cambio, y deja de notificar tras desuscribirse', async () => {
    const notificaciones: unknown[] = [];
    const desuscribirse = suscribirseACambiosDeSesion((sesion) => notificaciones.push(sesion));

    await supabase.auth.signInWithPassword({ email: 'ana@bayka.com', password: 'secreta' });
    expect(notificaciones).toEqual([{ user: { id: 'user-1', email: 'ana@bayka.com' } }]);

    desuscribirse();
    await supabase.auth.signOut();
    expect(notificaciones).toHaveLength(1);
  });
});

describe('actualizarPasswordUsuario', () => {
  test('éxito: no hay error y queda registrado el payload', async () => {
    const { error } = await actualizarPasswordUsuario('nueva-clave-123');
    expect(error).toBeNull();
    expect(estadoMock.actualizacionesUsuario).toEqual([{ password: 'nueva-clave-123' }]);
  });

  test('error: propaga el error del SDK', async () => {
    estadoMock.errorUpdateUser = { message: 'Auth session missing' };
    const { error } = await actualizarPasswordUsuario('nueva-clave-123');
    expect(error).toEqual({ message: 'Auth session missing' });
  });
});
