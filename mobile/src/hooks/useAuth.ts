/**
 * useAuth — central auth hook for session, role, signIn, signOut.
 *
 * OFFLINE CONTRACT (inviolable):
 * - If NetInfo.isConnected === false → ZERO calls to supabase.*
 * - SecureStore keys (tokens, userId, role) are NEVER deleted except on explicit signOut()
 * - SIGNED_OUT events are IGNORED when offline
 * - Auto-refresh is STOPPED when offline, STARTED when online
 */
import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import { persistSession, readCachedSession, ROLE_KEY, EMAIL_KEY } from '../supabase/auth';
import { USER_ID_KEY } from './useCurrentUserId';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as SecureStore from 'expo-secure-store';
import { cacheCredential, verifyCredential, saveLastOnlineLogin, isOfflineLoginExpired } from '../services/OfflineAuthService';
import { classifyAuthError, authErrorMessage, AUTH_MESSAGES } from '../supabase/authErrors';
import type { Role } from '../types/domain';

const ROLE_FETCH_TIMEOUT = 5000;
const LOGIN_TIMEOUT = 8000;

/** Race a promise against a timeout. Rejects with 'timeout' on expiry. */
function withTimeout<T>(promiseOrThenable: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promiseOrThenable),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// ─── Module-level state (shared across all useAuth instances) ───────────────

type AuthState = {
  session: { access_token: string; refresh_token: string } | null;
  role: Role | null;
};

// Broadcast channel for offline login/logout — Supabase's onAuthStateChange
// only fires for online events, so we need this for offline state sync.
const authChangeListeners = new Set<(state: AuthState) => void>();

let autoRefreshActive = false;

/** Start auto-refresh if online; stop if offline. Idempotent. */
async function syncAutoRefresh(isConnected: boolean | null) {
  if (!isSupabaseConfigured) return;
  if (isConnected !== false && !autoRefreshActive) {
    await supabase.auth.startAutoRefresh();
    autoRefreshActive = true;
  } else if (isConnected === false && autoRefreshActive) {
    await supabase.auth.stopAutoRefresh();
    autoRefreshActive = false;
  }
}

// ─── Helpers (no network when offline) ──────────────────────────────────────

/** Respuesta ONLINE explícita: el server marcó la cuenta como desactivada
 *  (baja reversible desde la web). Distinto de un fallo de red, que cae al
 *  rol cacheado sin romper el contrato offline. */
export const CUENTA_DESACTIVADA = 'cuenta-desactivada' as const;
type RolObtenido = Role | typeof CUENTA_DESACTIVADA | null;

/**
 * Fetch role from Supabase profiles, cache it, return it.
 * Falls back to cached role on timeout/error. ONLY called when online.
 */
async function fetchAndCacheRole(userId: string, email?: string): Promise<RolObtenido> {
  try {
    const { data: profile } = await withTimeout(
      supabase.from('profiles').select('rol, activo').eq('id', userId).single(),
      ROLE_FETCH_TIMEOUT,
    );
    if (profile && profile.activo === false) {
      return CUENTA_DESACTIVADA;
    }
    if (profile?.rol) {
      await SecureStore.setItemAsync(ROLE_KEY, profile.rol);
      if (email) await SecureStore.setItemAsync(EMAIL_KEY, email);
      return profile.rol as Role;
    }
  } catch {
    // Timeout or error — fall through to cached
  }
  const cached = await SecureStore.getItemAsync(ROLE_KEY);
  return cached as Role | null;
}

/**
 * Restore session from SecureStore cache. ZERO network calls.
 * Used for offline init and as fallback when online init fails.
 */
async function restoreFromCache(): Promise<{ session: AuthState['session']; role: Role | null }> {
  const session = await readCachedSession();
  const role = await SecureStore.getItemAsync(ROLE_KEY) as Role | null;
  return { session, role };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAuth() {
  const [session, setSession] = useState<AuthState['session']>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const initializing = useRef(true);

  // Subscribe to cross-instance auth state broadcast
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
        const net = await NetInfo.fetch();
        const isOnline = net.isConnected !== false;

        await syncAutoRefresh(isOnline);

        let restored: { session: AuthState['session']; role: Role | null };

        if (isOnline) {
          // Online: try Supabase SDK first, fall back to cache
          try {
            const { data: { session: supabaseSession } } = await supabase.auth.getSession();
            if (supabaseSession) {
              await persistSession(supabaseSession);
              await SecureStore.setItemAsync(USER_ID_KEY, supabaseSession.user.id);
              const cachedRole = await fetchAndCacheRole(supabaseSession.user.id, supabaseSession.user.email ?? '');
              if (cachedRole === CUENTA_DESACTIVADA) {
                // Baja confirmada por el server: signOut explícito (única vía
                // legítima de borrar las keys según el contrato offline).
                await signOut();
                restored = { session: null, role: null };
              } else {
                restored = { session: supabaseSession, role: cachedRole };
              }
            } else {
              restored = await restoreFromCache();
            }
          } catch {
            // Online init failed (e.g. network blip) — fall back to cache
            restored = await restoreFromCache();
          }
        } else {
          // Offline: ZERO network calls — read everything from SecureStore
          restored = await restoreFromCache();
        }

        if (mounted && restored.session) {
          setSession(restored.session);
          if (restored.role) setRole(restored.role);
        }
      } catch (e) {
        console.error('[Auth] init failed:', e);
      } finally {
        initializing.current = false;
        if (mounted) setLoading(false);
      }
    })();

    // Listen for Supabase auth events — guard SIGNED_OUT when offline
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, supabaseSession) => {
        if (initializing.current) return;

        if (event === 'SIGNED_IN' && supabaseSession) {
          await persistSession(supabaseSession);
          await SecureStore.setItemAsync(USER_ID_KEY, supabaseSession.user.id);
          const fetchedRole = await fetchAndCacheRole(supabaseSession.user.id, supabaseSession.user.email ?? '');

          if (fetchedRole === CUENTA_DESACTIVADA) {
            await signOut();
            if (mounted) {
              setSession(null);
              setRole(null);
              setLoading(false);
            }
            return;
          }

          if (mounted) {
            setSession(supabaseSession);
            if (fetchedRole) setRole(fetchedRole);
            setLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          // CRITICAL: Only honor SIGNED_OUT when online.
          // Offline SIGNED_OUT is a false positive from failed token refresh.
          const net = await NetInfo.fetch();
          if (net.isConnected === false) {
            console.warn('[Auth] Ignoring SIGNED_OUT while offline — session preserved');
            return;
          }
          if (mounted) {
            setSession(null);
            setRole(null);
            setLoading(false);
          }
        }
      }
    );

    // Connectivity listener: start/stop auto-refresh
    const unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      syncAutoRefresh(state.isConnected);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      unsubscribeNetInfo();
    };
  }, []);

  // ─── Sign In ────────────────────────────────────────────────────────────

  async function handleOfflineSignIn(email: string, password: string) {
    const expired = await isOfflineLoginExpired();
    if (expired) {
      return { data: { session: null, user: null }, error: { message: 'Sesion offline expirada. Conectate a internet para iniciar sesion.' } };
    }

    const cachedRole = await verifyCredential(email, password);
    if (!cachedRole) {
      return { data: { session: null, user: null }, error: { message: 'Credenciales incorrectas o no guardadas. Inicia sesion online primero.' } };
    }

    const offlineSession = await readCachedSession();
    if (!offlineSession) {
      return { data: { session: null, user: null }, error: { message: 'Sin sesion previa. Conectate al menos una vez.' } };
    }

    await SecureStore.setItemAsync(ROLE_KEY, cachedRole);
    authChangeListeners.forEach(fn => fn({ session: offlineSession, role: cachedRole as Role }));

    return { data: { session: offlineSession, user: null }, error: null };
  }

  /** Persist + cache everything after a successful online sign in.
   *  Devuelve false si la cuenta está desactivada (no se cachea nada). */
  async function persistOnlineSession(email: string, password: string, session: any): Promise<boolean> {
    await persistSession(session);
    await SecureStore.setItemAsync(USER_ID_KEY, session.user.id);
    await syncAutoRefresh(true);

    const userRole = await fetchAndCacheRole(session.user.id, session.user.email ?? '');
    if (userRole === CUENTA_DESACTIVADA) return false;
    await cacheCredential(email, password, userRole ?? 'tecnico');
    await saveLastOnlineLogin();
    return true;
  }

  /**
   * Backend unreachable while the device has network (down/paused server, 5xx,
   * non-JSON response, timeout). Try offline login with cached credentials; if
   * that's not possible, surface a clear connectivity message instead of the
   * offline "credenciales no guardadas" wording, which would mislead the user.
   */
  async function handleConnectivityFailure(email: string, password: string) {
    const offline = await handleOfflineSignIn(email, password);
    if (!offline.error) return offline;
    return { data: { session: null, user: null }, error: { message: AUTH_MESSAGES.connectivity } };
  }

  async function signIn(email: string, password: string) {
    // Fast path: definitely offline → instant offline login (ZERO supabase calls)
    const net = await NetInfo.fetch();
    if (net.isConnected === false) {
      return handleOfflineSignIn(email, password);
    }

    let result;
    try {
      result = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        LOGIN_TIMEOUT,
      );
    } catch {
      // Thrown (network failure / timeout) → offline fallback or connectivity.
      return handleConnectivityFailure(email, password);
    }

    if (!result.error) {
      if (result.data.session) {
        const cuentaActiva = await persistOnlineSession(email, password, result.data.session);
        if (!cuentaActiva) {
          await signOut();
          return {
            data: { session: null, user: null },
            error: { message: AUTH_MESSAGES.account_disabled },
          };
        }
      }
      return result;
    }

    // Backend returned an error WITHOUT throwing. A down/paused backend yields a
    // non-JSON parse error here — that's connectivity, not bad credentials.
    if (classifyAuthError(result.error) === 'connectivity') {
      return handleConnectivityFailure(email, password);
    }
    // Real credential / unknown error → friendly message, never the raw SDK one.
    return { data: { session: null, user: null }, error: { message: authErrorMessage(result.error) } };
  }

  // ─── Sign Out ───────────────────────────────────────────────────────────

  async function signOut() {
    authChangeListeners.forEach(fn => fn({ session: null, role: null }));

    await supabase.auth.stopAutoRefresh();
    autoRefreshActive = false;

    try { await SecureStore.deleteItemAsync(ROLE_KEY); } catch {}

    // Clear Supabase SDK state from AsyncStorage — no network calls
    try {
      const keys = await AsyncStorage.getAllKeys();
      const sbKeys = keys.filter(k => k.startsWith('sb-'));
      if (sbKeys.length > 0) await AsyncStorage.multiRemove(sbKeys);
    } catch {}
  }

  return { session, role, loading, signIn, signOut };
}
