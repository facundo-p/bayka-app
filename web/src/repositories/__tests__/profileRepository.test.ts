import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import { cambiarRol } from '../profileRepository';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

describe('cambiarRol', () => {
  test('actualiza profiles.rol filtrando por el id del usuario', async () => {
    const consultas = capturarConsultas(() => ({ data: null }));
    await cambiarRol('user-2', 'admin');

    const [update] = consultas;
    expect(update.tabla).toBe('profiles');
    expect(update.operacion).toBe('update');
    expect(update.payload).toEqual({ rol: 'admin' });
    expect(update.filtros).toEqual([{ metodo: 'eq', columna: 'id', valor: 'user-2' }]);
  });

  test('un mensaje legible del trigger del server se muestra tal cual', async () => {
    capturarConsultas(() => ({
      error: { message: 'P0001: Un superadmin no puede degradarse a sí mismo' },
    }));
    await expect(cambiarRol('user-1', 'admin')).rejects.toThrow(
      'Un superadmin no puede degradarse a sí mismo',
    );
  });

  test('el guard de rol del trigger también llega legible', async () => {
    capturarConsultas(() => ({
      error: { message: 'Solo un superadmin puede cambiar roles' },
    }));
    await expect(cambiarRol('user-2', 'superadmin')).rejects.toThrow(
      'Solo un superadmin puede cambiar roles',
    );
  });

  test('la falla de red se traduce a "revisá tu conexión"', async () => {
    capturarConsultas(() => ({ error: { message: 'TypeError: Failed to fetch' } }));
    await expect(cambiarRol('user-2', 'admin')).rejects.toThrow(
      'No se pudo cambiar el rol. Revisá tu conexión y probá de nuevo.',
    );
  });

  test('el rechazo de RLS se traduce a falta de permiso (#380)', async () => {
    capturarConsultas(() => ({ error: { message: 'permission denied', code: '42501' } }));
    await expect(cambiarRol('user-2', 'admin')).rejects.toThrow(
      'No tenés permiso para cambiar el rol.',
    );
  });
});
