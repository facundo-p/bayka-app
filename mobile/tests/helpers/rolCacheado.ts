/** Fija el rol y el userId que devuelven `readCachedRole` y `readCachedUserId` (SecureStore está mockeado en los setups). */
import * as SecureStore from 'expo-secure-store';
import { ROLE_KEY, USER_ID_KEY } from '../../src/supabase/auth';

export function conRolCacheado(rol: string | null, userId: string | null = null): void {
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
    if (key === ROLE_KEY) return rol;
    return key === USER_ID_KEY ? userId : null;
  });
}

/**
 * Cachea el userId de la sesión del SDK mockeada: el guard de sesión exige que
 * coincidan (#658). Respeta lo que el test ya devolvía para las otras claves.
 */
export function conUsuarioCacheado(userId: string | (() => string | null)): void {
  const mock = SecureStore.getItemAsync as jest.Mock;
  const previa = mock.getMockImplementation();
  mock.mockImplementation(async (key: string) => {
    if (key === USER_ID_KEY) return typeof userId === 'function' ? userId() : userId;
    return previa ? previa(key) : null;
  });
}
