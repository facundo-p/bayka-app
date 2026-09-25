/**
 * useAuth — hook central de auth: sesión, rol, signIn, signOut.
 * Contrato offline (inviolable): sin red, CERO llamadas a supabase.*; SIGNED_OUT se ignora
 * offline; auto-refresh se para offline y arranca online.
 * SecureStore: signOut() borra solo el rol y la sesión solo local; los tokens y el userId quedan
 * para que la misma cuenta vuelva a entrar offline. El login offline de otra cuenta descarta los
 * tokens ajenos (#658), y una cuenta desactivada se purga entera.
 */
import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import {
  persistSession, clearSession, readCachedSession, readCachedUserId, readSesionCacheada, iniciarSesionSoloLocal,
  ROLE_KEY, EMAIL_KEY, USER_ID_KEY, SESION_SOLO_LOCAL_KEY, type SesionCacheada,
} from '../supabase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as SecureStore from 'expo-secure-store';
import {
  cacheCredential, verifyCredential, esCredencialSinUsuario, saveLastOnlineLogin, isOfflineLoginExpired, clearAllCredentials,
} from '../services/OfflineAuthService';
import { classifyAuthError, authErrorMessage, AUTH_MESSAGES } from '../supabase/authErrors';
import type { Role } from '../types/domain';
import { ROL } from '../constants/roles';
import { conReloj } from '../utils/conReloj';

const ROLE_FETCH_TIMEOUT = 5000;
const LOGIN_TIMEOUT = 8000;

const MENSAJE_OFFLINE_EXPIRADO = 'Sesión offline expirada. Conectate a internet para iniciar sesión.';
const MENSAJE_OFFLINE_SIN_CREDENCIAL = 'Credenciales incorrectas o no guardadas. Iniciá sesión online primero.';
const MENSAJE_OFFLINE_SIN_HABILITAR = 'Iniciá sesión con conexión una vez para habilitar el acceso sin conexión.';

/** Race a promise against a timeout. Rejects with 'timeout' on expiry. */
function withTimeout<T>(promiseOrThenable: PromiseLike<T>, ms: number): Promise<T> {
  return conReloj(promiseOrThenable, ms, () => new Error('timeout'));
}

// ─── Module-level state (shared across all useAuth instances) ───────────────

type AuthState = {
  session: SesionCacheada | null;
  role: Role | null;
};

// Broadcast channel: onAuthStateChange de Supabase solo dispara para eventos online, esto cubre el sync de estado offline.
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

/** Purga TODO el estado de sesión (tokens, credenciales offline, rol, email, SDK) al confirmar online que la cuenta fue desactivada — a diferencia de signOut(), que preserva las credenciales offline por contrato. */
async function purgarSesionDesactivada() {
  authChangeListeners.forEach(fn => fn({ session: null, role: null }));
  await supabase.auth.stopAutoRefresh();
  autoRefreshActive = false;
  try { await clearSession(); } catch {}
  try { await clearAllCredentials(); } catch {}
  try { await SecureStore.deleteItemAsync(ROLE_KEY); } catch {}
  try { await SecureStore.deleteItemAsync(EMAIL_KEY); } catch {}
  try { await SecureStore.deleteItemAsync(USER_ID_KEY); } catch {}
  await borrarEstadoDelSdk();
}

/** Borra la sesión que el SDK de Supabase guarda en AsyncStorage; sin red. */
async function borrarEstadoDelSdk() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const sbKeys = keys.filter(k => k.startsWith('sb-'));
    if (sbKeys.length > 0) await AsyncStorage.multiRemove(sbKeys);
  } catch {}
}

function sinSesion(message: string) {
  return { data: { session: null, user: null }, error: { message } };
}

/**
 * Sesión para un login offline de `userId`: reusa los tokens cacheados solo si
 * son suyos. Si son de otra cuenta, abre una sesión solo local sin rastro de la
 * anterior, así nada se sube con la identidad de otro (#658).
 */
async function sesionOfflinePara(userId: string): Promise<SesionCacheada> {
  if (userId === (await readCachedUserId())) {
    const tokens = await readCachedSession();
    if (tokens) return tokens;
  }
  await borrarEstadoDelSdk();
  return iniciarSesionSoloLocal(userId);
}

// ─── Helpers (no network when offline) ──────────────────────────────────────

/** Respuesta ONLINE explícita de cuenta desactivada (baja reversible desde la web); distinto de un fallo de red, que cae al rol cacheado. */
export const CUENTA_DESACTIVADA = 'cuenta-desactivada' as const;
type RolObtenido = Role | typeof CUENTA_DESACTIVADA | null;

type SesionOnline = { access_token: string; refresh_token: string; user: { id: string; email?: string } };

/**
 * Cachea la cuenta de una sesión online: tokens, userId y email. El email va sin
 * esperar al rol: si esa consulta falla quedaría el de la cuenta anterior, y el
 * perfil legado de esa cuenta se adoptaría con el userId de esta (#668).
 */
async function cachearSesionOnline(session: SesionOnline): Promise<void> {
  await persistSession(session);
  await SecureStore.setItemAsync(USER_ID_KEY, session.user.id);
  const { email } = session.user;
  if (email) await SecureStore.setItemAsync(EMAIL_KEY, email);
  else await SecureStore.deleteItemAsync(EMAIL_KEY);
}

/** Trae el rol de Supabase profiles y lo cachea; si falla/timeoutea, cae al rol cacheado. Solo se llama online. */
async function fetchAndCacheRole(userId: string): Promise<RolObtenido> {
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
      return profile.rol as Role;
    }
  } catch {
    // Timeout or error — fall through to cached
  }
  const cached = await SecureStore.getItemAsync(ROLE_KEY);
  return cached as Role | null;
}

/** Restaura sesión desde el cache de SecureStore; CERO llamadas de red. Usado en init offline y como fallback si el init online falla. */
async function restoreFromCache(): Promise<{ session: AuthState['session']; role: Role | null }> {
  const session = await readSesionCacheada();
  const role = await SecureStore.getItemAsync(ROLE_KEY) as Role | null;
  return { session, role };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAuth() {
  const [session, setSession] = useState<AuthState['session']>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const initializing = useRef(true);

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
              await cachearSesionOnline(supabaseSession);
              const cachedRole = await fetchAndCacheRole(supabaseSession.user.id);
              if (cachedRole === CUENTA_DESACTIVADA) {
                await purgarSesionDesactivada();
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, supabaseSession) => {
        if (initializing.current) return;

        if (event === 'SIGNED_IN' && supabaseSession) {
          await cachearSesionOnline(supabaseSession);
          const fetchedRole = await fetchAndCacheRole(supabaseSession.user.id);

          if (fetchedRole === CUENTA_DESACTIVADA) {
            await purgarSesionDesactivada();
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
          // SIGNED_OUT se ignora offline: es un falso positivo de un refresh de token fallido.
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
    if (await isOfflineLoginExpired()) return sinSesion(MENSAJE_OFFLINE_EXPIRADO);

    const cuenta = await verifyCredential(email, password);
    if (!cuenta) return sinSesion(MENSAJE_OFFLINE_SIN_CREDENCIAL);
    if (esCredencialSinUsuario(cuenta)) return sinSesion(MENSAJE_OFFLINE_SIN_HABILITAR);

    const offlineSession = await sesionOfflinePara(cuenta.userId);
    await SecureStore.setItemAsync(USER_ID_KEY, cuenta.userId);
    await SecureStore.setItemAsync(ROLE_KEY, cuenta.role);
    authChangeListeners.forEach(fn => fn({ session: offlineSession, role: cuenta.role as Role }));

    return { data: { session: offlineSession, user: null }, error: null };
  }

  /** Persiste + cachea sesión tras un signIn online exitoso; retorna false si la cuenta está desactivada (no cachea nada). */
  async function persistOnlineSession(email: string, password: string, session: any): Promise<boolean> {
    await cachearSesionOnline(session);
    await syncAutoRefresh(true);

    const userRole = await fetchAndCacheRole(session.user.id);
    if (userRole === CUENTA_DESACTIVADA) return false;
    await cacheCredential(email, password, userRole ?? ROL.tecnico, session.user.id);
    await saveLastOnlineLogin();
    return true;
  }

  /** Backend inalcanzable con red disponible (caído/pausado, 5xx, no-JSON, timeout): intenta login offline con credenciales cacheadas; si no hay, muestra el mensaje de conectividad (no el "credenciales no guardadas" offline, que confundiría). */
  async function handleConnectivityFailure(email: string, password: string) {
    const offline = await handleOfflineSignIn(email, password);
    if (!offline.error) return offline;
    return sinSesion(AUTH_MESSAGES.connectivity);
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
          await purgarSesionDesactivada();
          return sinSesion(AUTH_MESSAGES.account_disabled);
        }
      }
      return result;
    }

    // Error sin throw: un backend caído/pausado devuelve acá un parse error no-JSON — es conectividad, no credenciales malas.
    if (classifyAuthError(result.error) === 'connectivity') {
      return handleConnectivityFailure(email, password);
    }
    // Cuenta desactivada: mismo purge que en purgarSesionDesactivada().
    if (classifyAuthError(result.error) === 'account_disabled') {
      await purgarSesionDesactivada();
      return sinSesion(AUTH_MESSAGES.account_disabled);
    }
    // Real credential / unknown error → friendly message, never the raw SDK one.
    return sinSesion(authErrorMessage(result.error));
  }

  // ─── Sign Out ───────────────────────────────────────────────────────────

  async function signOut() {
    authChangeListeners.forEach(fn => fn({ session: null, role: null }));

    await supabase.auth.stopAutoRefresh();
    autoRefreshActive = false;

    try { await SecureStore.deleteItemAsync(ROLE_KEY); } catch {}
    try { await SecureStore.deleteItemAsync(SESION_SOLO_LOCAL_KEY); } catch {}
    await borrarEstadoDelSdk();
  }

  return { session, role, loading, signIn, signOut };
}
