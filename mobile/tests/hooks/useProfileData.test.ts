// Tests for useProfileData hook
// Validates profile fetch from Supabase, SecureStore cache, and offline fallback

import * as SecureStore from 'expo-secure-store';
import { setOnline, setSinInternet, setRedDesconocida } from '../helpers/networkHelper';

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

  it('writes fetched profile to SecureStore under user_profile_cache', async () => {
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

    expect(JSON.parse(store.get(PROFILE_CACHE_KEY)!)).toEqual({ ...mockProfile, userId: 'user-1' });
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
      expect(JSON.parse(store.get(PROFILE_CACHE_KEY)!)).toEqual({ ...mockProfile, userId: 'user-1' });
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
      expect(JSON.parse(store.get(PROFILE_CACHE_KEY)!)).not.toHaveProperty('userId');
    });
  });

  it('no cachea el perfil de una sesión del SDK de otra cuenta', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'user-a', email: 'a@x.com' } } });

    const { result } = renderHook(() => useProfileData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.profile).toBeNull();
    expect(store.has(PROFILE_CACHE_KEY)).toBe(false);
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
});
