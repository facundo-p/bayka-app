/**
 * useAuth — hook central de auth: sesión, rol, signIn, signOut.
 * Criterio de red en services/conexion.ts. Sin red (`sinRed`): CERO llamadas a supabase.*.
 * Sin conexión confirmada (`constaSinConexion`): el arranque restaura del cache sin red y
 * revalida contra el servidor cuando la conexión se confirma; el auto-refresh se para; el login
 * offline va primero y, si no alcanza, se intenta online. SIGNED_OUT del SDK solo cierra la
 * sesión con conexión confirmada.
 * SecureStore: signOut() borra solo el rol y la sesión solo local; los tokens y el userId quedan
 * para que la misma cuenta vuelva a entrar offline. El login offline de otra cuenta descarta los
 * tokens ajenos (#658), y una cuenta desactivada se purga entera.
 */
import { useState, useEffect, useRef } from 'react';
import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { esSinFilas } from '../supabase/postgresErrorCodes';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import {
  persistSession, clearSession, readCachedSession, readCachedUserId, readSesionCacheada, iniciarSesionSoloLocal,
  ROLE_KEY, EMAIL_KEY, USER_ID_KEY, SESION_SOLO_LOCAL_KEY, type SesionCacheada,
} from '../supabase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { constaSinConexion, estaConectado, sinRed } from '../services/conexion';
import * as SecureStore from 'expo-secure-store';
import {
  cacheCredential, verifyCredential, esCredencialSinUsuario, saveLastOnlineLogin, isOfflineLoginExpired, clearAllCredentials,
} from '../services/OfflineAuthService';
import { classifyAuthError, authErrorMessage, AUTH_MESSAGES } from '../supabase/authErrors';
import type { Role } from '../types/domain';
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

/**
 * Cambia con cada login, logout o purga. Lo que corre sin que el usuario espere (el init de
 * cada instancia, la revalidación del arranque) la captura al empezar y no escribe nada si
 * cambió: no revive una sesión cerrada ni pisa la cuenta que entró mientras tanto.
 */
let epocaDeSesion = 0;

function nuevaEpocaDeSesion() {
  epocaDeSesion++;
}

function vigenteDesdeAhora(): () => boolean {
  const epoca = epocaDeSesion;
  return () => epoca === epocaDeSesion;
}

/** Start auto-refresh if online; stop if offline. Idempotent. */
async function syncAutoRefresh(online: boolean) {
  if (!isSupabaseConfigured) return;
  if (online && !autoRefreshActive) {
    await supabase.auth.startAutoRefresh();
    autoRefreshActive = true;
  } else if (!online && autoRefreshActive) {
    await supabase.auth.stopAutoRefresh();
    autoRefreshActive = false;
  }
}

/**
 * Descarta la sesión de una cuenta que no puede entrar: tokens, rol, email, userId y SDK.
 * A diferencia de signOut(), no deja nada para volver a entrar offline con ella.
 */
async function descartarSesion() {
  nuevaEpocaDeSesion();
  authChangeListeners.forEach(fn => fn({ session: null, role: null }));
  await supabase.auth.stopAutoRefresh();
  autoRefreshActive = false;
  try { await clearSession(); } catch {}
  try { await SecureStore.deleteItemAsync(ROLE_KEY); } catch {}
  try { await SecureStore.deleteItemAsync(EMAIL_KEY); } catch {}
  try { await SecureStore.deleteItemAsync(USER_ID_KEY); } catch {}
  await borrarEstadoDelSdk();
}

/** Cuenta desactivada confirmada online: descarta la sesión y además todas las credenciales offline. */
async function purgarSesionDesactivada() {
  await descartarSesion();
  try { await clearAllCredentials(); } catch {}
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

/** Mensaje de un login online que el servidor aceptó pero no puede entrar. */
function mensajeDeLoginSinRol(rol: typeof CUENTA_DESACTIVADA | null | undefined): string {
  if (rol === CUENTA_DESACTIVADA) return AUTH_MESSAGES.account_disabled;
  return rol === null ? AUTH_MESSAGES.no_profile : AUTH_MESSAGES.connectivity;
}

type SesionOnline = { access_token: string; refresh_token: string; user: { id: string; email?: string } };

/**
 * Cachea la cuenta de una sesión online: tokens, userId y email. El email va sin
 * esperar al rol: si esa consulta falla quedaría el de la cuenta anterior, y el
 * perfil legado de esa cuenta se adoptaría con el userId de esta (#668).
 */
async function cachearSesionOnline(session: SesionOnline, vigente: () => boolean): Promise<void> {
  const { email } = session.user;
  const escrituras = [
    () => persistSession(session),
    () => SecureStore.setItemAsync(USER_ID_KEY, session.user.id),
    () => (email ? SecureStore.setItemAsync(EMAIL_KEY, email) : SecureStore.deleteItemAsync(EMAIL_KEY)),
  ];
  for (const escribir of escrituras) {
    if (!vigente()) return;
    await escribir();
  }
}

/**
 * Rol según Supabase profiles, cacheado si `vigente`. Null si el servidor respondió sin rol
 * (sin fila incluido); undefined si no respondió (red o timeout). Solo se llama online.
 */
async function consultarRol(userId: string, vigente: () => boolean): Promise<RolObtenido | undefined> {
  try {
    const { data: profile, error } = await withTimeout(
      supabase.from('profiles').select('rol, activo').eq('id', userId).single(),
      ROLE_FETCH_TIMEOUT,
    );
    if (error) return esSinFilas(error) ? null : undefined;
    if (profile?.activo === false) return CUENTA_DESACTIVADA;
    if (!profile?.rol) return null;
    if (vigente()) await SecureStore.setItemAsync(ROLE_KEY, profile.rol);
    return profile.rol as Role;
  } catch {
    return undefined;
  }
}

async function leerRolCacheado(): Promise<Role | null> {
  return (await SecureStore.getItemAsync(ROLE_KEY)) as Role | null;
}

/**
 * Rol de la credencial offline de esta misma cuenta, si la contraseña coincide. Una credencial
 * sin userId (anterior a #658) no prueba de qué cuenta es: no sirve de respaldo.
 */
async function rolCacheadoDeLaCuenta(email: string, password: string, userId: string): Promise<Role | undefined> {
  const cuenta = await verifyCredential(email, password);
  if (!cuenta || esCredencialSinUsuario(cuenta) || cuenta.userId !== userId) return undefined;
  return cuenta.role as Role;
}

/** Null si dejó de estar `vigente`; si la cuenta está desactivada, la purga. */
async function resolverSesion(sesion: Session, rol: RolObtenido, vigente: () => boolean): Promise<SesionRestaurada | null> {
  if (!vigente()) return null;
  if (rol !== CUENTA_DESACTIVADA) return { session: sesion, role: rol };
  await purgarSesionDesactivada();
  return { session: null, role: null };
}

type SesionRestaurada = { session: AuthState['session']; role: Role | null };

type OpcionesDeRestauracion = { soloDe?: string | null; vigente: () => boolean };

/**
 * Restaura la sesión del SDK: cachea tokens, refresca el rol y purga una cuenta desactivada.
 * Null si el SDK no tiene sesión, si es de otra cuenta que `soloDe`, o si deja de estar `vigente`.
 * Lanza si el servidor no respondió: el SDK no lanza ante un fallo de red, devuelve el error.
 */
async function restaurarDesdeSdk({ soloDe, vigente }: OpcionesDeRestauracion): Promise<SesionRestaurada | null> {
  const { data: { session: sdk }, error } = await supabase.auth.getSession();
  if (error && isAuthRetryableFetchError(error)) throw error;
  if (!sdk || (soloDe !== undefined && sdk.user.id !== soloDe)) return null;
  await cachearSesionOnline(sdk, vigente);
  const rol = await consultarRol(sdk.user.id, vigente);
  if (rol === undefined) throw new Error('El servidor no devolvió el rol');
  return resolverSesion(sdk, rol ?? (await leerRolCacheado()), vigente);
}

/** Restaura sesión desde el cache de SecureStore; CERO llamadas de red. Usado en init offline y como fallback si el init online falla. */
async function restoreFromCache(): Promise<SesionRestaurada> {
  const session = await readSesionCacheada();
  const role = await SecureStore.getItemAsync(ROLE_KEY) as Role | null;
  return { session, role };
}

/**
 * Sesión del arranque. Online: la del SDK o, si no hay, la del cache. Sin conexión confirmada
 * o si el servidor falla: la del cache, sin validar (se revalida al confirmarse la conexión).
 */
async function restaurarAlArrancar(online: boolean, vigente: () => boolean): Promise<{ sesion: SesionRestaurada; validada: boolean }> {
  if (!online) return { sesion: await restoreFromCache(), validada: false };
  try {
    return { sesion: (await restaurarDesdeSdk({ vigente })) ?? (await restoreFromCache()), validada: true };
  } catch {
    return { sesion: await restoreFromCache(), validada: false };
  }
}

// ─── Revalidación del arranque (una sola vez, compartida entre instancias) ───

let revalidacionPendiente: (() => boolean) | null = null;
let epocaRevalidada: number | null = null;
let redConfirmada = false;

/**
 * Último login online que pudo quedar en vuelo. Su SIGNED_IN puede llegar después del
 * timeout; si entretanto hubo logout u otro login, no debe revivir ni pisar nada. `rol` es
 * lo que respondió el servidor al handler, incluida la falta de perfil (null): tras purgar una
 * cuenta desactivada, reconsultarlo iría como anon y RLS no devolvería la fila.
 */
type LoginOnline = { vigente: () => boolean; email: string; rol?: RolObtenido };
let loginOnlineEnVuelo: LoginOnline | null = null;

function mismoEmail(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * SIGNED_IN del SDK: del login en vuelo (lo corre adentro, o tarde tras un timeout) o, sin
 * login, del SDK solo. Null si hay que ignorarlo.
 */
async function alIniciarSesionEnSdk(sesion: Session): Promise<SesionRestaurada | null> {
  const login = loginOnlineEnVuelo;
  if (login && !mismoEmail(login.email, sesion.user.email)) return null;
  const vigente = login?.vigente ?? vigenteDesdeAhora();
  await cachearSesionOnline(sesion, vigente);
  const delServidor = await consultarRol(sesion.user.id, vigente);
  // Una desactivación no se rebaja: tras purgarla, otra consulta va como anon y no ve la fila.
  if (login && delServidor !== undefined && login.rol !== CUENTA_DESACTIVADA) login.rol = delServidor;
  return resolverSesion(sesion, delServidor ?? (await leerRolCacheado()), vigente);
}

/** Solo para tests: resetea el estado compartido entre casos. */
export function __resetEstadoCompartido(): void {
  revalidacionPendiente = null;
  epocaRevalidada = null;
  redConfirmada = false;
  loginOnlineEnVuelo = null;
}

function armarRevalidacion(vigente: () => boolean) {
  if (!vigente() || epocaRevalidada === epocaDeSesion) return;
  epocaRevalidada = epocaDeSesion;
  revalidacionPendiente = vigente;
  if (redConfirmada) dispararRevalidacion();
}

function alCambiarRed(confirmada: boolean) {
  redConfirmada = confirmada;
  if (confirmada) dispararRevalidacion();
}

function dispararRevalidacion() {
  const vigente = revalidacionPendiente;
  revalidacionPendiente = null;
  if (vigente?.()) revalidarSesion(vigente);
}

async function revalidarSesion(vigente: () => boolean) {
  try {
    const restored = await restaurarDesdeSdk({ soloDe: await readCachedUserId(), vigente });
    if (restored?.session && vigente()) authChangeListeners.forEach(fn => fn(restored));
  } catch (e) {
    console.warn('[Auth] revalidación online falló:', e);
    // Queda para la próxima confirmación de red, no para ya: sin loop contra un servidor caído.
    if (vigente()) revalidacionPendiente = vigente;
  }
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
      const vigente = vigenteDesdeAhora();
      try {
        const net = await NetInfo.fetch();
        const isOnline = !constaSinConexion(net);
        await syncAutoRefresh(isOnline);

        const { sesion, validada } = await restaurarAlArrancar(isOnline, vigente);
        if (mounted && sesion.session && vigente()) {
          setSession(sesion.session);
          if (sesion.role) setRole(sesion.role);
          if (!validada) armarRevalidacion(vigente);
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
          const resultado = await alIniciarSesionEnSdk(supabaseSession);
          if (!resultado || !mounted) return;
          setSession(resultado.session);
          if (!resultado.session || resultado.role) setRole(resultado.role);
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          // Sin conexión confirmada es un falso positivo de un refresh de token fallido: ante la duda se conserva la sesión.
          const net = await NetInfo.fetch();
          if (!estaConectado(net)) {
            console.warn('[Auth] SIGNED_OUT ignorado sin conexión confirmada: se conserva la sesión');
            return;
          }
          nuevaEpocaDeSesion();
          if (mounted) {
            setSession(null);
            setRole(null);
            setLoading(false);
          }
        }
      }
    );

    const unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      syncAutoRefresh(!constaSinConexion(state));
      alCambiarRed(estaConectado(state));
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

    nuevaEpocaDeSesion();
    const offlineSession = await sesionOfflinePara(cuenta.userId);
    await SecureStore.setItemAsync(USER_ID_KEY, cuenta.userId);
    await SecureStore.setItemAsync(ROLE_KEY, cuenta.role);
    authChangeListeners.forEach(fn => fn({ session: offlineSession, role: cuenta.role as Role }));

    return { data: { session: offlineSession, user: null }, error: null };
  }

  /**
   * Rol con el que entra un login online: el del servidor (o el que le dio al handler
   * SIGNED_IN) o, si no respondió, el cacheado de esta misma cuenta. Null si el servidor
   * respondió sin perfil; undefined si no respondió y no hay rol cacheado.
   */
  async function rolDelLoginOnline(email: string, password: string, userId: string, login: LoginOnline): Promise<RolObtenido | undefined> {
    const delServidor = login.rol !== undefined ? login.rol : await consultarRol(userId, login.vigente);
    if (delServidor !== undefined) return delServidor;
    return rolCacheadoDeLaCuenta(email, password, userId);
  }

  /**
   * Persiste + cachea sesión tras un signIn online exitoso y devuelve el rol obtenido. La
   * credencial offline se cachea solo con un rol real: nunca uno supuesto, ni de una cuenta
   * desactivada.
   */
  async function persistOnlineSession(email: string, password: string, session: SesionOnline, login: LoginOnline): Promise<RolObtenido | undefined> {
    const { vigente } = login;
    await cachearSesionOnline(session, vigente);
    if (vigente()) await syncAutoRefresh(true);

    const rol = await rolDelLoginOnline(email, password, session.user.id, login);
    // Sin rol real, o un logout o login posterior ganó: no se cachea nada a nombre de este login.
    if (!rol || rol === CUENTA_DESACTIVADA || !vigente()) return rol;
    // El rol pudo salir del cache y no del servidor: se publica igual, o el login queda sin rol.
    await SecureStore.setItemAsync(ROLE_KEY, rol);
    if (!vigente()) return rol;
    authChangeListeners.forEach(fn => fn({ session, role: rol }));
    await cacheCredential(email, password, rol, session.user.id);
    await saveLastOnlineLogin();
    return rol;
  }

  /** Backend inalcanzable con red disponible (caído/pausado, 5xx, no-JSON, timeout): intenta login offline con credenciales cacheadas; si no hay, muestra el mensaje de conectividad (no el "credenciales no guardadas" offline, que confundiría). */
  async function handleConnectivityFailure(email: string, password: string, offlineYaIntentado: boolean) {
    if (!offlineYaIntentado) {
      const offline = await handleOfflineSignIn(email, password);
      if (!offline.error) return offline;
    }
    return sinSesion(AUTH_MESSAGES.connectivity);
  }

  /**
   * Sin red: solo offline. Con red pero internet sin confirmar: offline primero y, ante
   * cualquier fallo, online. Se reintenta también con contraseña incorrecta: la credencial
   * local puede estar vieja (contraseña cambiada en la web), el servidor es quien decide, y
   * tratar igual "no cacheada" y "no coincide" no delata qué cuentas guarda el teléfono.
   * Si internet sí andaba, ese login offline no renueva lastOnlineLogin, credencial ni rol, ni
   * detecta una cuenta desactivada: eso lo cubre ensureServerSession al sincronizar.
   */
  async function signIn(email: string, password: string) {
    const net = await NetInfo.fetch();
    if (sinRed(net)) return handleOfflineSignIn(email, password);
    const offlinePrimero = constaSinConexion(net);
    if (offlinePrimero) {
      const offline = await handleOfflineSignIn(email, password);
      if (!offline.error) return offline;
    }
    return signInOnline(email, password, offlinePrimero);
  }

  async function signInOnline(email: string, password: string, offlineYaIntentado: boolean) {
    // La época cambia antes de llamar al SDK: su handler SIGNED_IN corre adentro y la usa.
    nuevaEpocaDeSesion();
    const login: LoginOnline = { vigente: vigenteDesdeAhora(), email };
    loginOnlineEnVuelo = login;
    const pedido = supabase.auth.signInWithPassword({ email, password });
    let result;
    try {
      result = await withTimeout(pedido, LOGIN_TIMEOUT);
    } catch {
      // Red caída o timeout: sigue en vuelo, su SIGNED_IN tardío respeta lo que pase después.
      completarLoginTardio(pedido, email, password, login);
      return handleConnectivityFailure(email, password, offlineYaIntentado);
    }
    if (loginOnlineEnVuelo === login) loginOnlineEnVuelo = null;
    if (!result.error) return aceptarLoginOnline(email, password, result, login);
    return rechazoDeLoginOnline(email, password, result.error, offlineYaIntentado);
  }

  /**
   * Un login que timeouteó puede entrar después: si nada lo reemplazó, se completa como uno
   * a tiempo (credencial offline, lastOnlineLogin, auto-refresh), o se descarta si no puede entrar.
   */
  async function completarLoginTardio(pedido: ReturnType<typeof supabase.auth.signInWithPassword>, email: string, password: string, login: LoginOnline) {
    try {
      const result = await pedido;
      if (loginOnlineEnVuelo === login) loginOnlineEnVuelo = null;
      if (!result.error && login.vigente()) await aceptarLoginOnline(email, password, result, login);
    } catch (e) {
      console.warn('[Auth] login online tardío falló:', e);
    }
  }

  async function aceptarLoginOnline<R extends { data: { session: SesionOnline | null } }>(email: string, password: string, result: R, login: LoginOnline) {
    if (!result.data.session) return result;
    const rol = await persistOnlineSession(email, password, result.data.session, login);
    if (rol && rol !== CUENTA_DESACTIVADA) return result;
    const desactivada = rol === CUENTA_DESACTIVADA;
    // Si ya no es vigente, lo resolvió otro: el handler SIGNED_IN, un logout u otro login.
    if (login.vigente()) await (desactivada ? purgarSesionDesactivada() : descartarSesion());
    return sinSesion(mensajeDeLoginSinRol(rol));
  }

  async function rechazoDeLoginOnline(email: string, password: string, error: Parameters<typeof classifyAuthError>[0], offlineYaIntentado: boolean) {
    // Un backend caído/pausado devuelve acá un parse error no-JSON — es conectividad, no credenciales malas.
    const tipo = classifyAuthError(error);
    if (tipo === 'connectivity') return handleConnectivityFailure(email, password, offlineYaIntentado);
    if (tipo === 'account_disabled') {
      await purgarSesionDesactivada();
      return sinSesion(AUTH_MESSAGES.account_disabled);
    }
    // Real credential / unknown error → friendly message, never the raw SDK one.
    return sinSesion(authErrorMessage(error));
  }

  // ─── Sign Out ───────────────────────────────────────────────────────────

  async function signOut() {
    nuevaEpocaDeSesion();
    authChangeListeners.forEach(fn => fn({ session: null, role: null }));

    await supabase.auth.stopAutoRefresh();
    autoRefreshActive = false;

    try { await SecureStore.deleteItemAsync(ROLE_KEY); } catch {}
    try { await SecureStore.deleteItemAsync(SESION_SOLO_LOCAL_KEY); } catch {}
    await borrarEstadoDelSdk();
  }

  return { session, role, loading, signIn, signOut };
}
