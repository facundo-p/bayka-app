import * as SecureStore from 'expo-secure-store';
import {
  leerPerfilCacheado, guardarPerfilCacheado, borrarPerfilCacheado, type CachedProfile,
} from '../../src/services/PerfilCacheadoService';

const USER_ID_KEY = 'user_id';
const RANURA_VIEJA = 'user_profile_cache';
const claveDe = (userId: string) => `user_profile_cache.${userId}`;

// Misma validación que expo-secure-store en el celular: una clave inválida tira.
const CLAVE_VALIDA = /^[\w.-]+$/;

const perfilA: CachedProfile = {
  nombre: 'Ana', email: 'ana@x.com', rol: 'admin', organizacionId: 'org-1', organizacionNombre: 'Org',
};
const perfilB: CachedProfile = {
  nombre: 'Beto', email: 'beto@x.com', rol: 'tecnico', organizacionId: 'org-1', organizacionNombre: 'Org',
};

let store: Map<string, string>;

function validar(k: string) {
  if (!CLAVE_VALIDA.test(k)) throw new Error(`clave inválida para SecureStore: ${k}`);
}

const logueado = (userId: string) => store.set(USER_ID_KEY, userId);
const guardado = (k: string) => JSON.parse(store.get(k)!);

beforeEach(() => {
  store = new Map();
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (k: string) => { validar(k); return store.get(k) ?? null; });
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (k: string, v: string) => { validar(k); store.set(k, v); });
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (k: string) => { validar(k); store.delete(k); });
});

describe('PerfilCacheadoService: un perfil por cuenta (#667)', () => {
  it('guarda cada perfil bajo la clave de su cuenta', async () => {
    await guardarPerfilCacheado('user-a', perfilA);
    await guardarPerfilCacheado('user-b', perfilB);

    expect(guardado('user_profile_cache.user-a')).toEqual(perfilA);
    expect(guardado('user_profile_cache.user-b')).toEqual(perfilB);
  });

  it('lee el perfil de la cuenta logueada aunque después haya guardado otra', async () => {
    await guardarPerfilCacheado('user-a', perfilA);
    await guardarPerfilCacheado('user-b', perfilB);

    logueado('user-a');
    expect(await leerPerfilCacheado()).toEqual(perfilA);
    logueado('user-b');
    expect(await leerPerfilCacheado()).toEqual(perfilB);
  });

  it('nunca devuelve el perfil de otra cuenta', async () => {
    await guardarPerfilCacheado('user-a', perfilA);

    logueado('user-b');
    expect(await leerPerfilCacheado()).toBeNull();
  });

  it('sin cuenta logueada no devuelve nada', async () => {
    await guardarPerfilCacheado('user-a', perfilA);

    expect(await leerPerfilCacheado()).toBeNull();
  });

  it('un perfil corrupto se lee como ausente', async () => {
    logueado('user-a');
    store.set(claveDe('user-a'), '{no es json');

    expect(await leerPerfilCacheado()).toBeNull();
  });

  it('borrarPerfilCacheado borra solo la entrada de esa cuenta', async () => {
    await guardarPerfilCacheado('user-a', perfilA);
    await guardarPerfilCacheado('user-b', perfilB);

    await borrarPerfilCacheado('user-a');

    expect(store.has(claveDe('user-a'))).toBe(false);
    expect(guardado(claveDe('user-b'))).toEqual(perfilB);
  });

  describe('migración de la ranura vieja única', () => {
    const conTokensDe = (email: string) => {
      store.set('supabase_access_token', 'at');
      store.set('supabase_refresh_token', 'rt');
      store.set('last_email', email);
    };

    it('con dueño: el usuario actual conserva su perfil y la ranura vieja se borra', async () => {
      logueado('user-a');
      store.set(RANURA_VIEJA, JSON.stringify({ ...perfilA, userId: 'user-a' }));

      expect(await leerPerfilCacheado()).toEqual(perfilA);
      expect(guardado(claveDe('user-a'))).toEqual(perfilA);
      expect(store.has(RANURA_VIEJA)).toBe(false);
    });

    it('de otra cuenta: pasa a la clave de su dueño y no se muestra a la actual', async () => {
      logueado('user-b');
      store.set(RANURA_VIEJA, JSON.stringify({ ...perfilA, userId: 'user-a' }));

      expect(await leerPerfilCacheado()).toBeNull();
      expect(guardado(claveDe('user-a'))).toEqual(perfilA);
      expect(store.has(RANURA_VIEJA)).toBe(false);
    });

    it('al guardar el perfil de otra cuenta, el de la ranura vieja no se pierde', async () => {
      logueado('user-b');
      store.set(RANURA_VIEJA, JSON.stringify({ ...perfilA, userId: 'user-a' }));

      await guardarPerfilCacheado('user-b', perfilB);

      expect(guardado(claveDe('user-a'))).toEqual(perfilA);
      expect(guardado(claveDe('user-b'))).toEqual(perfilB);
      expect(store.has(RANURA_VIEJA)).toBe(false);
    });

    it('no pisa una entrada por cuenta, que es más nueva', async () => {
      logueado('user-a');
      store.set(claveDe('user-a'), JSON.stringify({ ...perfilA, nombre: 'Ana nueva' }));
      store.set(RANURA_VIEJA, JSON.stringify({ ...perfilA, userId: 'user-a' }));

      expect((await leerPerfilCacheado())?.nombre).toBe('Ana nueva');
      expect(store.has(RANURA_VIEJA)).toBe(false);
    });

    it('sin dueño y con los tokens de la misma cuenta: se adopta para la cuenta logueada', async () => {
      logueado('user-a');
      conTokensDe(perfilA.email);
      store.set(RANURA_VIEJA, JSON.stringify(perfilA));

      expect(await leerPerfilCacheado()).toEqual(perfilA);
      expect(guardado(claveDe('user-a'))).toEqual(perfilA);
      expect(store.has(RANURA_VIEJA)).toBe(false);
    });

    it.each([
      ['sin tokens (sesión solo local)', () => store.set('last_email', perfilA.email)],
      ['con tokens de otro email', () => conTokensDe('otra@x.com')],
    ])('sin dueño y %s: no se adopta y se borra', async (_caso, preparar) => {
      logueado('user-b');
      preparar();
      store.set(RANURA_VIEJA, JSON.stringify(perfilA));

      expect(await leerPerfilCacheado()).toBeNull();
      expect(store.has(claveDe('user-b'))).toBe(false);
      expect(store.has(RANURA_VIEJA)).toBe(false);
    });

    it('al desactivar la cuenta dueña de la ranura vieja, su perfil no queda', async () => {
      logueado('user-b');
      store.set(RANURA_VIEJA, JSON.stringify({ ...perfilA, userId: 'user-a' }));

      await borrarPerfilCacheado('user-a');

      expect(store.has(claveDe('user-a'))).toBe(false);
      expect(store.has(RANURA_VIEJA)).toBe(false);
    });
  });
});
