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
    },
    from: jest.fn(),
  },
  isSupabaseConfigured: true,
}));

jest.mock('../../src/supabase/auth', () => ({
  persistSession: jest.fn().mockResolvedValue(undefined),
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
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (isOfflineLoginExpired as jest.Mock).mockResolvedValue(false);
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

  describe('signIn offline fallback', () => {
    it('calls verifyCredential when offline (NetInfo reports not connected)', async () => {
      setOffline();
      (verifyCredential as jest.Mock).mockResolvedValue('tecnico');
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'access_token') return Promise.resolve('cached-token');
        if (key === 'refresh_token') return Promise.resolve('cached-refresh');
        return Promise.resolve(null);
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
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'user_role') return Promise.resolve('admin');
        return Promise.resolve(null);
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
  });
});
