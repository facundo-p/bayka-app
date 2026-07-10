// Tests for useAuth hook
// Covers: signIn (online), signIn (offline fallback), signOut, role from SecureStore

import * as SecureStore from 'expo-secure-store';
import { setOffline, setOnline } from '../helpers/networkHelper';

jest.mock('expo-secure-store');

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      signInWithPassword: jest.fn(),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
      startAutoRefresh: jest.fn().mockResolvedValue(undefined),
      stopAutoRefresh: jest.fn().mockResolvedValue(undefined),
    },
    from: jest.fn(),
  },
  isSupabaseConfigured: true,
}));

jest.mock('../../src/supabase/auth', () => ({
  persistSession: jest.fn().mockResolvedValue(undefined),
  readCachedSession: jest.fn().mockResolvedValue(null),
  ACCESS_TOKEN_KEY: 'access_token',
  REFRESH_TOKEN_KEY: 'refresh_token',
  ROLE_KEY: 'user_role',
  EMAIL_KEY: 'user_email',
}));

jest.mock('../../src/services/OfflineAuthService', () => ({
  cacheCredential: jest.fn().mockResolvedValue(undefined),
  verifyCredential: jest.fn(),
  saveLastOnlineLogin: jest.fn().mockResolvedValue(undefined),
  isOfflineLoginExpired: jest.fn().mockResolvedValue(false),
  clearCredential: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/hooks/useCurrentUserId', () => ({
  USER_ID_KEY: 'user_id',
}));

const { supabase } = require('../../src/supabase/client');
const { readCachedSession } = require('../../src/supabase/auth');
const { verifyCredential, isOfflineLoginExpired } = require('../../src/services/OfflineAuthService');

import { renderHook, act } from '@testing-library/react-native';
import { useAuth } from '../../src/hooks/useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setOnline();

    // Default: no existing session
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
    (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
    (supabase.auth.startAutoRefresh as jest.Mock).mockResolvedValue(undefined);
    (supabase.auth.stopAutoRefresh as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (readCachedSession as jest.Mock).mockResolvedValue(null);
    (isOfflineLoginExpired as jest.Mock).mockResolvedValue(false);

    // AsyncStorage.getAllKeys must return an array for signOut
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
  });

  describe('signIn online', () => {
    it('calls supabase.auth.signInWithPassword when online with valid credentials', async () => {
      const mockSession = { access_token: 'token-abc', refresh_token: 'refresh-abc', user: { id: 'user-1', email: 'test@test.com' } };
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Mock supabase.from for profile fetch
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { rol: 'tecnico' }, error: null }),
      });

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'password');
      });

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password',
      });
      expect(signInResult.error).toBeNull();
    });

    it('caches credentials after successful online sign in', async () => {
      const mockSession = { access_token: 'token-abc', refresh_token: 'refresh-abc', user: { id: 'user-1', email: 'test@test.com' } };
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { rol: 'tecnico' }, error: null }),
      });

      const { cacheCredential } = require('../../src/services/OfflineAuthService');
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn('test@test.com', 'password');
      });

      expect(cacheCredential).toHaveBeenCalledWith('test@test.com', 'password', expect.any(String));
    });
  });

  describe('signIn online — backend down / errors (issue #64)', () => {
    it('never surfaces the raw parse error when backend is down and no cached creds', async () => {
      // Online, but backend returns a non-JSON error WITHOUT throwing.
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: 'JSON Parse error: Unexpected character e' },
      });
      (verifyCredential as jest.Mock).mockResolvedValue(null); // no cached creds

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'password');
      });

      expect(signInResult.error).not.toBeNull();
      expect(signInResult.error.message).not.toContain('JSON Parse');
      expect(signInResult.error.message).toContain('No se pudo conectar');
      expect(signInResult.data.session).toBeNull();
    });

    it('falls back to offline login when backend is down but creds are cached', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: 'JSON Parse error: Unexpected character e' },
      });
      (verifyCredential as jest.Mock).mockResolvedValue('tecnico');
      (readCachedSession as jest.Mock).mockResolvedValue({
        access_token: 'cached-token',
        refresh_token: 'cached-refresh',
      });

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'password');
      });

      expect(signInResult.error).toBeNull();
      expect(signInResult.data.session).toBeTruthy();
    });

    it('shows the credentials message (not raw) for real invalid credentials', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' },
      });

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'wrong');
      });

      expect(signInResult.error.message).toBe('Email o contraseña incorrectos.');
      // Must NOT trigger the offline fallback for a real credential error.
      expect(verifyCredential).not.toHaveBeenCalled();
    });
  });

  describe('signIn offline fallback', () => {
    it('calls verifyCredential when offline (NetInfo reports not connected)', async () => {
      setOffline();
      (verifyCredential as jest.Mock).mockResolvedValue('tecnico');
      (readCachedSession as jest.Mock).mockResolvedValue({
        access_token: 'cached-token',
        refresh_token: 'cached-refresh',
      });

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'password');
      });

      expect(verifyCredential).toHaveBeenCalledWith('test@test.com', 'password');
      expect(signInResult.error).toBeNull();
      expect(signInResult.data.session).toBeTruthy();
    });

    it('returns error when offline and credentials not cached', async () => {
      setOffline();
      (verifyCredential as jest.Mock).mockResolvedValue(null); // no cached credentials

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'wrong-password');
      });

      expect(signInResult.error).not.toBeNull();
      expect(signInResult.data.session).toBeNull();
    });

    it('returns error when offline login is expired', async () => {
      setOffline();
      (isOfflineLoginExpired as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useAuth());

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'password');
      });

      expect(signInResult.error).not.toBeNull();
      expect(signInResult.error.message).toContain('expirada');
    });
  });

  describe('signOut', () => {
    it('clears ROLE_KEY from SecureStore on sign out', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signOut();
      });

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('user_role');
    });

    it('sets session to null after sign out', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.session).toBeNull();
    });
  });

  describe('role', () => {
    it('reads role from SecureStore cache when available during init', async () => {
      // Mock profile fetch to return 'admin' role
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { rol: 'admin' }, error: null }),
          }),
        }),
      });

      const mockSession = { access_token: 'token', refresh_token: 'refresh', user: { id: 'u-1', email: 'a@a.com' } };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      const { result } = renderHook(() => useAuth());

      // Wait for init
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.role).toBe('admin');
    });

    it('un superadmin obtiene su rol y se cachea (opera como admin en campo)', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { rol: 'superadmin', activo: true }, error: null }),
          }),
        }),
      });
      const mockSession = { access_token: 'token', refresh_token: 'refresh', user: { id: 'u-1', email: 'a@a.com' } };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: mockSession } });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.role).toBe('superadmin');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('user_role', 'superadmin');
    });
  });

  describe('cuenta desactivada (baja reversible desde la web)', () => {
    function mockPerfilDesactivado() {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { rol: 'tecnico', activo: false }, error: null }),
          }),
        }),
      });
    }

    it('en el init online con sesión, desloguea y no restaura rol', async () => {
      mockPerfilDesactivado();
      const mockSession = { access_token: 'token', refresh_token: 'refresh', user: { id: 'u-1', email: 'a@a.com' } };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: mockSession } });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.session).toBeNull();
      expect(result.current.role).toBeNull();
      // El signOut explícito borra la key de rol (única excepción del contrato).
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('user_role');
    });

    it('en el signIn online devuelve el mensaje de cuenta desactivada y no cachea credenciales', async () => {
      mockPerfilDesactivado();
      const mockSession = { access_token: 'token-abc', refresh_token: 'refresh-abc', user: { id: 'user-1', email: 'test@test.com' } };
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      const { cacheCredential } = require('../../src/services/OfflineAuthService');

      const { result } = renderHook(() => useAuth());
      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn('test@test.com', 'password');
      });

      expect(signInResult.error.message).toContain('desactivada');
      expect(signInResult.data.session).toBeNull();
      expect(cacheCredential).not.toHaveBeenCalled();
    });

    it('offline NO consulta el estado: restaura la sesión cacheada (contrato intacto)', async () => {
      setOffline();
      (readCachedSession as jest.Mock).mockResolvedValue({
        access_token: 'cached-token',
        refresh_token: 'cached-refresh',
      });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tecnico');

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.session).not.toBeNull();
      expect(result.current.role).toBe('tecnico');
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('cross-instance broadcast', () => {
    it('signIn on one instance updates session/role on another instance', async () => {
      // Setup: mock successful offline signIn
      setOffline();
      (verifyCredential as jest.Mock).mockResolvedValue('tecnico');
      (readCachedSession as jest.Mock).mockResolvedValue({
        access_token: 'cached-token',
        refresh_token: 'cached-refresh',
      });

      // Render two hook instances (simulating two components)
      const { result: instance1 } = renderHook(() => useAuth());
      const { result: instance2 } = renderHook(() => useAuth());

      // Both start with null session
      expect(instance1.current.session).toBeNull();
      expect(instance2.current.session).toBeNull();

      // SignIn on instance1
      await act(async () => {
        await instance1.current.signIn('test@test.com', 'password');
      });

      // Wait for broadcast propagation
      await act(async () => {
        await new Promise(r => setTimeout(r, 50));
      });

      // Instance2 should also have the session now (via broadcast)
      expect(instance2.current.session).not.toBeNull();
      expect(instance2.current.role).toBe('tecnico');
    });

    it('signOut on one instance clears session on another instance', async () => {
      // First, sign in on instance1 so both have a session
      setOffline();
      (verifyCredential as jest.Mock).mockResolvedValue('tecnico');
      (readCachedSession as jest.Mock).mockResolvedValue({
        access_token: 'cached-token',
        refresh_token: 'cached-refresh',
      });

      const { result: instance1 } = renderHook(() => useAuth());
      const { result: instance2 } = renderHook(() => useAuth());

      await act(async () => {
        await instance1.current.signIn('test@test.com', 'password');
      });

      await act(async () => {
        await new Promise(r => setTimeout(r, 50));
      });

      // Both should have session
      expect(instance2.current.session).not.toBeNull();

      // SignOut on instance1
      await act(async () => {
        await instance1.current.signOut();
      });

      await act(async () => {
        await new Promise(r => setTimeout(r, 50));
      });

      // Instance2 should also be cleared
      expect(instance2.current.session).toBeNull();
      expect(instance2.current.role).toBeNull();
    });
  });
});
