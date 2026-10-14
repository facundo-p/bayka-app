import * as SecureStore from 'expo-secure-store';
import { EMAIL_KEY, readCachedSession, readCachedUserId } from '../supabase/auth';

export type CachedProfile = {
  nombre: string;
  email: string;
  rol: string;
  organizacionId: string;
  organizacionNombre: string;
};

/** Ranura única anterior a #667, pisada por cada login online. Se migra y se borra. */
const RANURA_VIEJA_KEY = 'user_profile_cache';

/** Un perfil por cuenta. SecureStore solo acepta `[\w.-]` en las claves: no va `:`. */
function claveDelPerfil(userId: string): string {
  return `${RANURA_VIEJA_KEY}.${userId}`;
}

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

async function duenioDeLaRanuraVieja({ userId, ...perfil }: PerfilGuardado): Promise<string | null> {
  if (userId) return userId;
  const actual = await readCachedUserId();
  return actual && (await esDeLaCuentaDeLosTokens(perfil)) ? actual : null;
}

/**
 * Pasa la ranura vieja a la clave de su dueño y la borra. Si el dueño ya tiene
 * su propia entrada, esa es más nueva y gana. Un perfil sin dueño atribuible se pierde:
 * el próximo login online de su cuenta lo vuelve a cachear.
 */
async function migrarRanuraVieja(): Promise<void> {
  const raw = await SecureStore.getItemAsync(RANURA_VIEJA_KEY);
  if (!raw) return;
  const guardado = parsear<PerfilGuardado>(raw);
  if (guardado) {
    const duenio = await duenioDeLaRanuraVieja(guardado);
    if (duenio && !(await SecureStore.getItemAsync(claveDelPerfil(duenio)))) await escribir(duenio, sinDuenio(guardado));
  }
  await SecureStore.deleteItemAsync(RANURA_VIEJA_KEY);
}

function sinDuenio({ userId: _userId, ...perfil }: PerfilGuardado): CachedProfile {
  return perfil;
}

function parsear<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function escribir(userId: string, perfil: CachedProfile): Promise<void> {
  await SecureStore.setItemAsync(claveDelPerfil(userId), JSON.stringify(perfil));
}

/** Perfil cacheado de la cuenta logueada; nunca el de otra cuenta del mismo celular. */
export async function leerPerfilCacheado(): Promise<CachedProfile | null> {
  await migrarRanuraVieja();
  const actual = await readCachedUserId();
  if (!actual) return null;
  return parsear<CachedProfile>(await SecureStore.getItemAsync(claveDelPerfil(actual)));
}

export async function guardarPerfilCacheado(userId: string, perfil: CachedProfile): Promise<void> {
  await migrarRanuraVieja();
  await escribir(userId, perfil);
}

/** Cuenta desactivada: su perfil no queda en el celular. */
export async function borrarPerfilCacheado(userId: string): Promise<void> {
  await migrarRanuraVieja();
  await SecureStore.deleteItemAsync(claveDelPerfil(userId));
}
