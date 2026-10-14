import * as SecureStore from 'expo-secure-store';
import type { Role } from '../types/domain';
import { ROL } from '../constants/roles';

const ROLES_VALIDOS: readonly string[] = Object.values(ROL);

// Separate keys to stay under expo-secure-store's 2048-byte limit
const ACCESS_TOKEN_KEY = 'supabase_access_token';
const REFRESH_TOKEN_KEY = 'supabase_refresh_token';
const ROLE_KEY = 'user_role';
const EMAIL_KEY = 'last_email';
// Los tokens cacheados son siempre de la cuenta en USER_ID_KEY: el login offline de otra cuenta los borra (#658).
const USER_ID_KEY = 'user_id';
const SESION_SOLO_LOCAL_KEY = 'sesion_solo_local';

export { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, ROLE_KEY, EMAIL_KEY, USER_ID_KEY, SESION_SOLO_LOCAL_KEY };

export type TokensDeSesion = { access_token: string; refresh_token: string };

/**
 * Sesión de un login offline sin tokens propios: habilita la app local pero no
 * el server, que pide login online antes de sincronizar (#658).
 */
export const SESION_SOLO_LOCAL = { soloLocal: true } as const;

export type SesionCacheada = TokensDeSesion | typeof SESION_SOLO_LOCAL;

export async function persistSession(session: TokensDeSesion): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.access_token);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refresh_token);
  await SecureStore.deleteItemAsync(SESION_SOLO_LOCAL_KEY);
}

async function borrarTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearSession(): Promise<void> {
  await borrarTokens();
  await SecureStore.deleteItemAsync(ROLE_KEY);
  await SecureStore.deleteItemAsync(SESION_SOLO_LOCAL_KEY);
  // EMAIL_KEY is intentionally kept — pre-fills login screen after logout
}

/** Abre una sesión solo local para `userId`, descartando los tokens de la cuenta anterior. Vale mientras USER_ID_KEY sea `userId`. */
export async function iniciarSesionSoloLocal(userId: string): Promise<typeof SESION_SOLO_LOCAL> {
  await borrarTokens();
  await SecureStore.setItemAsync(SESION_SOLO_LOCAL_KEY, userId);
  return SESION_SOLO_LOCAL;
}

/** Sesión a restaurar al abrir la app: los tokens o, si no hay, la sesión solo local. ZERO network calls. */
export async function readSesionCacheada(): Promise<SesionCacheada | null> {
  const tokens = await readCachedSession();
  if (tokens) return tokens;
  const duenio = await SecureStore.getItemAsync(SESION_SOLO_LOCAL_KEY);
  return duenio && duenio === (await readCachedUserId()) ? SESION_SOLO_LOCAL : null;
}

/** Read cached session tokens from SecureStore. ZERO network calls. */
export async function readCachedSession(): Promise<TokensDeSesion | null> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!accessToken || !refreshToken) return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}

/**
 * Rol cacheado al loguear; null sin sesión o si el valor guardado no es un rol
 * válido (dato corrupto o de una versión previa). Lo usan los repositorios, que
 * no tienen hooks.
 */
export async function readCachedRole(): Promise<Role | null> {
  const rol = await SecureStore.getItemAsync(ROLE_KEY);
  return rol != null && ROLES_VALIDOS.includes(rol) ? (rol as Role) : null;
}

/** userId cacheado al loguear; null sin sesión. Lo usan los repositorios, que no tienen hooks. */
export async function readCachedUserId(): Promise<string | null> {
  return SecureStore.getItemAsync(USER_ID_KEY);
}
