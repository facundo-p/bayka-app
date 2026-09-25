/** Fija el rol que devuelve `readCachedRole` (SecureStore está mockeado en los setups). */
import * as SecureStore from 'expo-secure-store';
import { ROLE_KEY } from '../../src/supabase/auth';

export function conRolCacheado(rol: string | null): void {
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
    key === ROLE_KEY ? rol : null,
  );
}
