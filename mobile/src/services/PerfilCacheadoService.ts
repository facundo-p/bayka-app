import * as SecureStore from 'expo-secure-store';
import { EMAIL_KEY, readCachedSession, readCachedUserId } from '../supabase/auth';

export type CachedProfile = {
  nombre: string;
  email: string;
  rol: string;
  organizacionId: string;
  organizacionNombre: string;
};

const PROFILE_CACHE_KEY = 'user_profile_cache';

type PerfilGuardado = CachedProfile & { userId?: string };

/**
 * Un perfil anterior a #658 no tiene dueño, pero lo escribió la sesión del último login
 * online, que es la de los tokens que siguen cacheados. Un login offline de otra cuenta
 * los borra, así que con tokens y el mismo email el perfil es de la cuenta logueada.
 */
async function esDeLaCuentaDeLosTokens(perfil: CachedProfile): Promise<boolean> {
  if (!(await readCachedSession())) return false;
  return perfil.email === (await SecureStore.getItemAsync(EMAIL_KEY));
}

/**
 * Perfil cacheado de la cuenta logueada. En un celular compartido el caché puede
 * ser de otra cuenta: entonces no se usa. Uno sin dueño se adopta si es de la cuenta
 * de los tokens, y se reescribe con su userId.
 */
export async function leerPerfilCacheado(): Promise<CachedProfile | null> {
  const raw = await SecureStore.getItemAsync(PROFILE_CACHE_KEY);
  if (!raw) return null;
  const { userId, ...perfil } = JSON.parse(raw) as PerfilGuardado;
  const actual = await readCachedUserId();
  if (!actual) return null;
  if (userId) return userId === actual ? perfil : null;
  if (!(await esDeLaCuentaDeLosTokens(perfil))) return null;
  await guardarPerfilCacheado(actual, perfil);
  return perfil;
}

export async function guardarPerfilCacheado(userId: string, perfil: CachedProfile): Promise<void> {
  const guardado: PerfilGuardado = { ...perfil, userId };
  await SecureStore.setItemAsync(PROFILE_CACHE_KEY, JSON.stringify(guardado));
}
