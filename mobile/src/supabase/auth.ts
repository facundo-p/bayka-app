import * as SecureStore from 'expo-secure-store';
import type { Role } from '../types/domain';
import { ROL } from '../constants/roles';

const ROLES_VALIDOS: readonly string[] = Object.values(ROL);

// Separate keys to stay under expo-secure-store's 2048-byte limit
const ACCESS_TOKEN_KEY = 'supabase_access_token';
const REFRESH_TOKEN_KEY = 'supabase_refresh_token';
const ROLE_KEY = 'user_role';
const EMAIL_KEY = 'last_email';
const USER_ID_KEY = 'user_id';

export { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, ROLE_KEY, EMAIL_KEY, USER_ID_KEY };

export async function persistSession(session: {
  access_token: string;
  refresh_token: string;
}): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.access_token);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refresh_token);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(ROLE_KEY);
  // EMAIL_KEY is intentionally kept — pre-fills login screen after logout
}

/** Read cached session tokens from SecureStore. ZERO network calls. */
export async function readCachedSession(): Promise<{ access_token: string; refresh_token: string } | null> {
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
