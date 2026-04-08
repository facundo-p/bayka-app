import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import { persistSession, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, ROLE_KEY, EMAIL_KEY } from '../supabase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as SecureStore from 'expo-secure-store';
import { cacheCredential, verifyCredential, saveLastOnlineLogin, isOfflineLoginExpired } from '../services/OfflineAuthService';
import type { Role } from '../types/domain';

/** Race a promise (or thenable) against a timeout. Rejects with 'timeout' on expiry. */
function withTimeout<T>(promiseOrThenable: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promiseOrThenable),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// Module-level auth state broadcast — ensures ALL useAuth instances stay in sync
// Needed because each useAuth() call creates independent React state.
// Online flows use onAuthStateChange (Supabase event). Offline flows use this.
type AuthState = {
  session: { access_token: string; refresh_token: string } | null;
  role: Role | null;
};
const authChangeListeners = new Set<(state: AuthState) => void>();

export function useAuth() {
  const [session, setSession] = useState<{ access_token: string; refresh_token: string } | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const initializing = useRef(true);

  // Subscribe to cross-instance auth state changes
  useEffect(() => {
    const listener = (state: AuthState) => {
      setSession(state.session);
      setRole(state.role);
    };
    authChangeListeners.add(listener);
    return () => { authChangeListeners.delete(listener); };
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      console.warn('[Auth] Supabase not configured — skipping auth init');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (mounted && currentSession) {
          await persistSession(currentSession);

          let cachedRole = await SecureStore.getItemAsync(ROLE_KEY);

          if (!cachedRole) {
            try {
              const { data: profile } = await withTimeout(
                supabase.from('profiles').select('rol').eq('id', currentSession.user.id).single(),
                5000,
              );
              if (profile?.rol) {
                cachedRole = profile.rol;
                await SecureStore.setItemAsync(ROLE_KEY, profile.rol);
                await SecureStore.setItemAsync(EMAIL_KEY, currentSession.user.email ?? '');
              }
            } catch {
              // Offline or timeout — continue without role
            }
          }

          if (mounted) {
            setSession(currentSession);
            if (cachedRole) setRole(cachedRole as Role);
          }
        }
      } catch (e) {
        console.error('[Auth] init failed:', e);
      } finally {
        initializing.current = false;
        if (mounted) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, supabaseSession) => {
        if (initializing.current) return;

        if (event === 'SIGNED_IN' && supabaseSession) {
          await persistSession(supabaseSession);

          try {
            const { data: profile } = await withTimeout(
              supabase.from('profiles').select('rol').eq('id', supabaseSession.user.id).single(),
              5000,
            );
            if (profile?.rol) {
              await SecureStore.setItemAsync(ROLE_KEY, profile.rol);
              await SecureStore.setItemAsync(EMAIL_KEY, supabaseSession.user.email ?? '');
              if (mounted) setRole(profile.rol as Role);
            }
          } catch {
            const cachedRole = await SecureStore.getItemAsync(ROLE_KEY);
            if (cachedRole && mounted) setRole(cachedRole as Role);
          }

          if (mounted) {
            setSession(supabaseSession);
            setLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          if (mounted) {
            setSession(null);
            setRole(null);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleOfflineSignIn(email: string, password: string) {
    const expired = await isOfflineLoginExpired();
    if (expired) {
      return { data: { session: null, user: null }, error: { message: 'Sesion offline expirada. Conectate a internet para iniciar sesion.' } };
    }

    const cachedRole = await verifyCredential(email, password);
    if (!cachedRole) {
      return { data: { session: null, user: null }, error: { message: 'Credenciales incorrectas o no guardadas. Inicia sesion online primero.' } };
    }

    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!accessToken || !refreshToken) {
      return { data: { session: null, user: null }, error: { message: 'Sin sesion previa. Conectate al menos una vez.' } };
    }

    const offlineSession = { access_token: accessToken, refresh_token: refreshToken };
    await SecureStore.setItemAsync(ROLE_KEY, cachedRole);

    // Broadcast to ALL useAuth instances (_layout.tsx needs this for navigation)
    authChangeListeners.forEach(fn => fn({ session: offlineSession, role: cachedRole as Role }));

    return { data: { session: offlineSession, user: null }, error: null };
  }

  async function signIn(email: string, password: string) {
    // Fast path: definitely offline → instant offline login
    const net = await NetInfo.fetch();
    if (net.isConnected === false) {
      return handleOfflineSignIn(email, password);
    }

    // Online or indeterminate → try Supabase with timeout, fallback to offline
    try {
      const result = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        8000,
      );

      if (!result.error && result.data.session) {
        await persistSession(result.data.session);

        try {
          const { data: profile } = await withTimeout(
            supabase.from('profiles').select('rol').eq('id', result.data.session.user.id).single(),
            5000,
          );
          const userRole = profile?.rol ?? 'tecnico';
          await cacheCredential(email, password, userRole);
          await saveLastOnlineLogin();
        } catch {
          await cacheCredential(email, password, 'tecnico');
          await saveLastOnlineLogin();
        }
      }
      return result;
    } catch {
      return handleOfflineSignIn(email, password);
    }
  }

  async function signOut() {
    // 1. Broadcast to ALL useAuth instances — immediate UI reset everywhere
    authChangeListeners.forEach(fn => fn({ session: null, role: null }));

    // 2. Clear role from SecureStore (tokens + credentials stay for offline re-login)
    try { await SecureStore.deleteItemAsync(ROLE_KEY); } catch {}

    // 3. Clear Supabase session from AsyncStorage directly — no network calls
    try {
      const keys = await AsyncStorage.getAllKeys();
      const sbKeys = keys.filter(k => k.startsWith('sb-'));
      if (sbKeys.length > 0) await AsyncStorage.multiRemove(sbKeys);
    } catch {}
  }

  return { session, role, loading, signIn, signOut };
}
