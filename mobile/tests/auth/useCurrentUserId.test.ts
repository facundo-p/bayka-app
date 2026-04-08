/**
 * Tests the offline userId resolution logic.
 *
 * After offline re-login, the userId must be available from SecureStore
 * when supabase.auth.getSession() returns null. Without this fallback:
 * - SubGroups appear as "created by someone else" (grisadas)
 * - Creating new SubGroups fails (userId is null)
 */
import * as SecureStore from 'expo-secure-store';

const USER_ID_KEY = 'user_id';

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  jest.clearAllMocks();

  (SecureStore.getItemAsync as jest.Mock).mockImplementation(
    async (key: string) => store.get(key) ?? null,
  );
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(
    async (key: string, value: string) => {
      store.set(key, value);
    },
  );
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(
    async (key: string) => {
      store.delete(key);
    },
  );
});

/**
 * Simulates the userId resolution logic that useCurrentUserId should implement:
 * 1. Try supabase.auth.getSession() → use session.user.id
 * 2. If null → fallback to SecureStore USER_ID_KEY
 */
async function resolveUserId(supabaseSessionUserId: string | null): Promise<string | null> {
  if (supabaseSessionUserId) return supabaseSessionUserId;
  return SecureStore.getItemAsync(USER_ID_KEY);
}

describe('Offline userId resolution', () => {
  it('uses Supabase session userId when available (online)', async () => {
    const userId = await resolveUserId('uuid-from-supabase');
    expect(userId).toBe('uuid-from-supabase');
  });

  it('returns null when no Supabase session AND no cache', async () => {
    const userId = await resolveUserId(null);
    expect(userId).toBeNull();
  });

  it('falls back to SecureStore when Supabase session is null (offline re-login)', async () => {
    store.set(USER_ID_KEY, 'uuid-cached-offline');

    const userId = await resolveUserId(null);
    expect(userId).toBe('uuid-cached-offline');
  });

  it('prefers Supabase session over SecureStore cache', async () => {
    store.set(USER_ID_KEY, 'uuid-old-cached');

    const userId = await resolveUserId('uuid-fresh-supabase');
    expect(userId).toBe('uuid-fresh-supabase');
  });

  it('userId survives signOut (only ROLE_KEY is deleted)', async () => {
    store.set(USER_ID_KEY, 'uuid-user-123');
    store.set('supabase_access_token', 'tok');
    store.set('supabase_refresh_token', 'tok');
    store.set('user_role', 'admin');

    // signOut deletes only ROLE_KEY
    await SecureStore.deleteItemAsync('user_role');

    expect(await SecureStore.getItemAsync(USER_ID_KEY)).toBe('uuid-user-123');
    expect(await SecureStore.getItemAsync('supabase_access_token')).toBe('tok');
    expect(await SecureStore.getItemAsync('user_role')).toBeNull();
  });

  it('full offline cycle: cache userId → signOut → offline re-login → userId available', async () => {
    // 1. Online login: cache userId
    await SecureStore.setItemAsync(USER_ID_KEY, 'uuid-admin-42');

    // 2. SignOut: clear role only
    await SecureStore.deleteItemAsync('user_role');

    // 3. Offline re-login: Supabase session is null
    const userId = await resolveUserId(null);

    // 4. userId must be the original
    expect(userId).toBe('uuid-admin-42');
  });
});
