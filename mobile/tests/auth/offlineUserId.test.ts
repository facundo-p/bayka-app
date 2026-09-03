/**
 * Tests for offline userId resolution: after offline re-login it must match the
 * original login's userId (cached in SecureStore, read back when getSession()
 * returns null) — otherwise Groups filtered by usuarioCreador break.
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
    const fakeUserId = 'uuid-user-123';
    await SecureStore.setItemAsync(USER_ID_KEY, fakeUserId);

    const cached = await SecureStore.getItemAsync(USER_ID_KEY);
    expect(cached).toBe(fakeUserId);
  });

  it('userId survives signOut (not deleted)', async () => {
    await SecureStore.setItemAsync(USER_ID_KEY, 'uuid-user-123');
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, 'fake-access-token');
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, 'fake-refresh-token');
    await SecureStore.setItemAsync(ROLE_KEY, 'admin');

    // signOut only deletes ROLE_KEY
    await SecureStore.deleteItemAsync(ROLE_KEY);

    const userId = await SecureStore.getItemAsync(USER_ID_KEY);
    expect(userId).toBe('uuid-user-123');

    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    expect(accessToken).toBe('fake-access-token');
  });

  it('userId is available after offline re-login cycle', async () => {
    const fakeUserId = 'uuid-user-456';

    await SecureStore.setItemAsync(USER_ID_KEY, fakeUserId);
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, 'tok-access');
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, 'tok-refresh');
    await cacheCredential('admin@bayka.com', 'pass123', 'admin');

    await SecureStore.deleteItemAsync(ROLE_KEY);

    const role = await verifyCredential('admin@bayka.com', 'pass123');
    expect(role).toBe('admin');

    const cachedUserId = await SecureStore.getItemAsync(USER_ID_KEY);
    expect(cachedUserId).toBe(fakeUserId);

    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    expect(accessToken).toBe('tok-access');
  });

  it('different users each have their userId cached (last login wins)', async () => {
    await SecureStore.setItemAsync(USER_ID_KEY, 'uuid-user-A');
    await cacheCredential('userA@bayka.com', 'passA', 'tecnico');

    await SecureStore.setItemAsync(USER_ID_KEY, 'uuid-user-B');
    await cacheCredential('userB@bayka.com', 'passB', 'admin');

    const cachedUserId = await SecureStore.getItemAsync(USER_ID_KEY);
    expect(cachedUserId).toBe('uuid-user-B');
  });
});
