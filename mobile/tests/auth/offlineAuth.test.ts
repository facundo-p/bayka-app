import * as SecureStore from 'expo-secure-store';
import {
  cacheCredential,
  verifyCredential,
  clearCredential,
  getCachedEmails,
} from '../../src/services/OfflineAuthService';

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

describe('OfflineAuthService', () => {
  it('caches credential with hash, not plaintext', async () => {
    await cacheCredential('user@test.com', 'pass123', 'tecnico');

    const raw = store.get('offline_credentials');
    expect(raw).toBeDefined();

    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    // No plaintext password field stored
    expect(parsed[0]).not.toHaveProperty('password');
    expect(parsed[0].hash).toBeDefined();
    expect(parsed[0].hash).not.toBe('pass123');
    expect(parsed[0].salt).toBeDefined();
    expect(parsed[0].email).toBe('user@test.com');
    expect(parsed[0].role).toBe('tecnico');
  });

  it('verifies correct password', async () => {
    await cacheCredential('user@test.com', 'pass123', 'tecnico');
    const role = await verifyCredential('user@test.com', 'pass123');
    expect(role).toBe('tecnico');
  });

  it('rejects wrong password', async () => {
    await cacheCredential('user@test.com', 'pass123', 'tecnico');
    const role = await verifyCredential('user@test.com', 'wrongpass');
    expect(role).toBeNull();
  });

  it('rejects unknown email', async () => {
    const role = await verifyCredential('unknown@test.com', 'pass123');
    expect(role).toBeNull();
  });

  it('clears only target user, others remain', async () => {
    await cacheCredential('user1@test.com', 'pass1', 'admin');
    await cacheCredential('user2@test.com', 'pass2', 'tecnico');

    await clearCredential('user1@test.com');

    const role1 = await verifyCredential('user1@test.com', 'pass1');
    expect(role1).toBeNull();

    const role2 = await verifyCredential('user2@test.com', 'pass2');
    expect(role2).toBe('tecnico');
  });

  it('getCachedEmails returns email list', async () => {
    await cacheCredential('user1@test.com', 'pass1', 'admin');
    await cacheCredential('user2@test.com', 'pass2', 'tecnico');

    const emails = await getCachedEmails();
    expect(emails).toEqual(['user1@test.com', 'user2@test.com']);
  });

  it('getCachedEmails deletes old saved_accounts key', async () => {
    store.set('saved_accounts', JSON.stringify([{ email: 'old@test.com', password: 'plain' }]));

    await getCachedEmails();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('saved_accounts');
  });

  it('updates existing entry on re-cache', async () => {
    await cacheCredential('user@test.com', 'pass1', 'tecnico');
    await cacheCredential('user@test.com', 'pass2', 'admin');

    const emails = await getCachedEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0]).toBe('user@test.com');

    // Should verify with new password, not old
    const roleOld = await verifyCredential('user@test.com', 'pass1');
    expect(roleOld).toBeNull();

    const roleNew = await verifyCredential('user@test.com', 'pass2');
    expect(roleNew).toBe('admin');
  });

  it('getCachedEmails returns empty array when no credentials', async () => {
    const emails = await getCachedEmails();
    expect(emails).toEqual([]);
  });
});
