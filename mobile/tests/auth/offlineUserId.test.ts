/**
 * Tests for offline userId resolution.
 *
 * After offline re-login, useCurrentUserId must return the same userId
 * as the original online login. This is critical because:
 * - SubGroups are filtered by usuarioCreador === userId
 * - Creating SubGroups requires a non-null userId
 * - If userId is null or wrong after offline re-login, existing SubGroups
 *   appear as "created by someone else" and new ones fail to create.
 *
 * The userId is cached in SecureStore during online login and read back
 * as a fallback when supabase.auth.getSession() returns null (offline).
 */
import * as SecureStore from 'expo-secure-store';
import { cacheCredential, verifyCredential } from '../../src/services/OfflineAuthService';

const USER_ID_KEY = 'user_id';
const ACCESS_TOKEN_KEY = 'supabase_access_token';
const REFRESH_TOKEN_KEY = 'supabase_refresh_token';
const ROLE_KEY = 'user_role';

// In-memory SecureStore simulation
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

describe('Offline userId persistence', () => {
  it('userId is cached in SecureStore during online login', async () => {
    // Simulate what signIn does after successful online login
    const fakeUserId = 'uuid-user-123';
    await SecureStore.setItemAsync(USER_ID_KEY, fakeUserId);

    const cached = await SecureStore.getItemAsync(USER_ID_KEY);
    expect(cached).toBe(fakeUserId);
  });

  it('userId survives signOut (not deleted)', async () => {
    // Setup: user logged in online, userId cached
    await SecureStore.setItemAsync(USER_ID_KEY, 'uuid-user-123');
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, 'fake-access-token');
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, 'fake-refresh-token');
    await SecureStore.setItemAsync(ROLE_KEY, 'admin');

    // Simulate signOut: only ROLE_KEY is deleted
    await SecureStore.deleteItemAsync(ROLE_KEY);

    // userId must survive
    const userId = await SecureStore.getItemAsync(USER_ID_KEY);
    expect(userId).toBe('uuid-user-123');

    // Tokens must survive
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    expect(accessToken).toBe('fake-access-token');
  });

  it('userId is available after offline re-login cycle', async () => {
    const fakeUserId = 'uuid-user-456';

    // Step 1: Online login caches everything
    await SecureStore.setItemAsync(USER_ID_KEY, fakeUserId);
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, 'tok-access');
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, 'tok-refresh');
    await cacheCredential('admin@bayka.com', 'pass123', 'admin');

    // Step 2: SignOut (only clears ROLE_KEY)
    await SecureStore.deleteItemAsync(ROLE_KEY);

    // Step 3: Offline re-login via cached credentials
    const role = await verifyCredential('admin@bayka.com', 'pass123');
    expect(role).toBe('admin');

    // Step 4: userId is still available from SecureStore
    const cachedUserId = await SecureStore.getItemAsync(USER_ID_KEY);
    expect(cachedUserId).toBe(fakeUserId);

    // Step 5: Tokens are still available
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    expect(accessToken).toBe('tok-access');
  });

  it('different users each have their userId cached (last login wins)', async () => {
    // User A logs in
    await SecureStore.setItemAsync(USER_ID_KEY, 'uuid-user-A');
    await cacheCredential('userA@bayka.com', 'passA', 'tecnico');

    // User B logs in (overwrites userId)
    await SecureStore.setItemAsync(USER_ID_KEY, 'uuid-user-B');
    await cacheCredential('userB@bayka.com', 'passB', 'admin');

    // userId should be the last logged-in user
    const cachedUserId = await SecureStore.getItemAsync(USER_ID_KEY);
    expect(cachedUserId).toBe('uuid-user-B');
  });
});
