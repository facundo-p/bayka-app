// Tests for useProfileData hook
// Validates profile fetch from Supabase, SecureStore cache, and offline fallback

import * as SecureStore from 'expo-secure-store';
import { setOnline, setOffline, setSinInternet, setRedDesconocida } from '../helpers/networkHelper';

jest.mock('expo-secure-store');
jest.mock('../../src/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const { supabase } = require('../../src/supabase/client');

import { renderHook, waitFor } from '@testing-library/react-native';
import { useProfileData, CachedProfile } from '../../src/hooks/useProfileData';

const mockProfile: CachedProfile = {
  nombre: 'Juan',
  email: 'juan@example.com',
  rol: 'tecnico',
  organizacionId: 'org-1',
  organizacionNombre: 'Org Test',
};

function makeSupabaseChain(returnVal: any) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(returnVal),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };
  return chain;
}

const USER_ID_KEY = 'user_id';
const PROFILE_CACHE_KEY = 'user_profile_cache';
const claveDe = (userId: string) => `user_profile_cache.${userId}`;
let store: Map<string, string>;

function cachear(perfil: object) {
  store.set(PROFILE_CACHE_KEY, JSON.stringify(perfil));
}

describe('useProfileData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store = new Map([[USER_ID_KEY, 'user-1']]);
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (k: string) => store.get(k) ?? null);
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (k: string, v: string) => { store.set(k, v); });
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (k: string) => { store.delete(k); });
    setOnline();
  });

  it.each([
    ['conectado sin internet', setSinInternet],
    ['red desconocida', setRedDesconocida],
  ])('%s: muestra el perfil cacheado sin consultar el server (#652)', async (_caso, setRed) => {
    setRed();
    cachear({ ...mockProfile, userId: 'user-1' });

    const { result } = renderHook(() => useProfileData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(result.current.profile).toEqual(mockProfile);
  });

  it('returns loading=true initially, then loading=false after resolving', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
    });

    const { result } = renderHook(() => useProfileData());
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('returns cached profile from SecureStore when no Supabase user', async () => {
    cachear({ ...mockProfile, userId: 'user-1' });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
    });

    const { result } = renderHook(() => useProfileData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toEqual(mockProfile);
  });

  it('fetches profile from Supabase when online and updates state', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1', email: 'juan@example.com' } },
    });

    // Joined query: select(...organizations(nombre)) nests organizations data in the response.
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeSupabaseChain({
          data: {
            nombre: 'Juan',
            rol: 'tecnico',
            organizacion_id: 'org-1',
            organizations: { nombre: 'Org Test' },
          },
          error: null,
        });
      }
      return makeSupabaseChain({ data: null, error: null });
    });

    const { result } = renderHook(() => useProfileData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).not.toBeNull();
    expect(result.current.profile?.nombre).toBe('Juan');
    expect(result.current.profile?.email).toBe('juan@example.com');
    expect(result.current.profile?.organizacionNombre).toBe('Org Test');
  });

  it('writes fetched profile to SecureStore under the key of its account', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1', email: 'juan@example.com' } },
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeSupabaseChain({
          data: {
            nombre: 'Juan',
            rol: 'tecnico',
            organizacion_id: 'org-1',
            organizations: { nombre: 'Org Test' },
          },
          error: null,
        });
      }
      return makeSupabaseChain({ data: null, error: null });
    });

    const { result } = renderHook(() => useProfileData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(JSON.parse(store.get(claveDe('user-1'))!)).toEqual(mockProfile);
  });

  // Celular compartido (#658): B no ve el perfil ni el rol de A.
  it('descarta el perfil cacheado de otra cuenta', async () => {
    cachear({ ...mockProfile, rol: 'admin', userId: 'user-a' });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null } });

    const { result } = renderHook(() => useProfileData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.profile).toBeNull();
  });

  describe('perfil sin dueño, anterior a #658', () => {
    const conTokensDe = (email: string) => {
      store.set('supabase_access_token', 'at');
      store.set('supabase_refresh_token', 'rt');
      store.set('last_email', email);
    };

    async function perfilLeido() {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null } });
      const { result } = renderHook(() => useProfileData());
      await waitFor(() => expect(result.current.loading).toBe(false));
      return result.current.profile;
    }

    it('con los tokens de la misma cuenta se usa y se reescribe con su userId', async () => {
      cachear(mockProfile);
      conTokensDe(mockProfile.email);

      expect(await perfilLeido()).toEqual(mockProfile);
      expect(JSON.parse(store.get(claveDe('user-1'))!)).toEqual(mockProfile);
      expect(store.has(PROFILE_CACHE_KEY)).toBe(false);
    });

    it('en una sesión solo local (sin tokens) se descarta', async () => {
      cachear(mockProfile);
      store.set('last_email', mockProfile.email);

      expect(await perfilLeido()).toBeNull();
    });

    it('con tokens de otro email se descarta', async () => {
      cachear(mockProfile);
      conTokensDe('otra@example.com');

      expect(await perfilLeido()).toBeNull();
      expect(store.has(claveDe('user-1'))).toBe(false);
    });
  });

  it('no cachea el perfil de una sesión del SDK de otra cuenta', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'user-a', email: 'a@x.com' } } });

    const { result } = renderHook(() => useProfileData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.profile).toBeNull();
    expect(store.has(claveDe('user-a'))).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns cached profile when Supabase throws (offline fallback)', async () => {
    cachear({ ...mockProfile, userId: 'user-1' });
    (supabase.auth.getUser as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useProfileData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toEqual(mockProfile);
  });

  describe('celular compartido: un perfil por cuenta (#667)', () => {
    const perfilA: CachedProfile = { ...mockProfile, nombre: 'Ana', email: 'a@x.com', rol: 'admin' };
    const perfilB: CachedProfile = { ...mockProfile, nombre: 'Beto', email: 'b@x.com', rol: 'admin', organizacionId: 'org-2' };

    function servidorCon(userId: string, perfil: CachedProfile) {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: userId, email: perfil.email } } });
      (supabase.from as jest.Mock).mockReturnValue(makeSupabaseChain({
        data: {
          nombre: perfil.nombre,
          rol: perfil.rol,
          organizacion_id: perfil.organizacionId,
          organizations: { nombre: perfil.organizacionNombre },
        },
        error: null,
      }));
    }

    async function perfilDe(userId: string) {
      store.set(USER_ID_KEY, userId);
      const { result } = renderHook(() => useProfileData());
      await waitFor(() => expect(result.current.loading).toBe(false));
      return result.current.profile;
    }

    it('A online, B online, B offline: B ve su perfil; A offline ve el suyo', async () => {
      servidorCon('user-a', perfilA);
      expect(await perfilDe('user-a')).toEqual(perfilA);
      servidorCon('user-b', perfilB);
      expect(await perfilDe('user-b')).toEqual(perfilB);

      setOffline();
      jest.clearAllMocks();
      expect(await perfilDe('user-b')).toEqual(perfilB);
      expect(await perfilDe('user-a')).toEqual(perfilA);
      expect(supabase.auth.getUser).not.toHaveBeenCalled();
    });

    it('una cuenta que nunca entró online no ve el perfil de otra', async () => {
      servidorCon('user-a', perfilA);
      await perfilDe('user-a');

      setOffline();
      expect(await perfilDe('user-c')).toBeNull();
    });
  });
});
