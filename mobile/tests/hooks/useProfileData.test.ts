// Tests for useProfileData hook
// Validates profile fetch from Supabase, SecureStore cache, and offline fallback

import * as SecureStore from 'expo-secure-store';

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

import { renderHook } from '@testing-library/react-native';
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

describe('useProfileData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns loading=true initially, then loading=false after resolving', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
    });

    const { result } = renderHook(() => useProfileData());
    // Initially loading=true
    expect(result.current.loading).toBe(true);

    // Wait for async resolution
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.loading).toBe(false);
  });

  it('returns cached profile from SecureStore when no Supabase user', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(mockProfile));
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
    });

    const { result } = renderHook(() => useProfileData());
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.profile).toEqual(mockProfile);
  });

  it('fetches profile from Supabase when online and updates state', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1', email: 'juan@example.com' } },
    });

    let callCount = 0;
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeSupabaseChain({
          data: { nombre: 'Juan', rol: 'tecnico', organizacion_id: 'org-1' },
          error: null,
        });
      }
      if (table === 'organizations') {
        return makeSupabaseChain({
          data: { nombre: 'Org Test' },
          error: null,
        });
      }
      return makeSupabaseChain({ data: null, error: null });
    });

    const { result } = renderHook(() => useProfileData());
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.profile).not.toBeNull();
    expect(result.current.profile?.nombre).toBe('Juan');
    expect(result.current.profile?.email).toBe('juan@example.com');
    expect(result.current.profile?.organizacionNombre).toBe('Org Test');
  });

  it('writes fetched profile to SecureStore under user_profile_cache', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1', email: 'juan@example.com' } },
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeSupabaseChain({
          data: { nombre: 'Juan', rol: 'tecnico', organizacion_id: 'org-1' },
          error: null,
        });
      }
      if (table === 'organizations') {
        return makeSupabaseChain({
          data: { nombre: 'Org Test' },
          error: null,
        });
      }
      return makeSupabaseChain({ data: null, error: null });
    });

    const { result } = renderHook(() => useProfileData());
    await new Promise((r) => setTimeout(r, 50));

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'user_profile_cache',
      expect.any(String)
    );
  });

  it('returns cached profile when Supabase throws (offline fallback)', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(mockProfile));
    (supabase.auth.getUser as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useProfileData());
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.loading).toBe(false);
  });
});
