import * as SecureStore from 'expo-secure-store';
import { readCachedUserId } from '../supabase/auth';

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
 * Perfil cacheado de la cuenta logueada. En un celular compartido el caché puede
 * ser de otra cuenta, o anterior a #658 y sin dueño: en ambos casos no se usa.
 */
export async function leerPerfilCacheado(): Promise<CachedProfile | null> {
  const raw = await SecureStore.getItemAsync(PROFILE_CACHE_KEY);
  if (!raw) return null;
  const { userId, ...perfil } = JSON.parse(raw) as PerfilGuardado;
  return userId && userId === (await readCachedUserId()) ? perfil : null;
}

export async function guardarPerfilCacheado(userId: string, perfil: CachedProfile): Promise<void> {
  const guardado: PerfilGuardado = { ...perfil, userId };
  await SecureStore.setItemAsync(PROFILE_CACHE_KEY, JSON.stringify(guardado));
}
