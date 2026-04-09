/**
 * Integration tests: Offline Auth full cycle
 * Tests: cacheCredential -> verifyCredential -> clearCredential -> TTL expiry
 * Uses real OfflineAuthService with mocked platform APIs (SecureStore, Crypto)
 * Platform mocks are provided by setup.integration.ts
 */

import * as SecureStore from 'expo-secure-store';
import {
  cacheCredential,
  verifyCredential,
  clearCredential,
  getCachedEmails,
  saveLastOnlineLogin,
  isOfflineLoginExpired,
} from '../../src/services/OfflineAuthService';
import { OFFLINE_LOGIN_EXPIRE, OFFLINE_LOGIN_DURATION_HS } from '../../src/config/offlineLogin';

// In-memory SecureStore simulator
const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  jest.restoreAllMocks();

  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => store.get(key) ?? null);
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key: string, value: string) => {
    store.set(key, value);
  });
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
    store.delete(key);
  });
});

describe('offlineAuthCycle', () => {
  describe('credential caching', () => {
    it('cacheCredential stores hashed credential in SecureStore', async () => {
      await cacheCredential('user@test.com', 'mypassword', 'tecnico');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('offline_credentials', expect.any(String));

      const storedRaw = store.get('offline_credentials');
      expect(storedRaw).toBeDefined();
      const entries = JSON.parse(storedRaw!);
      expect(entries).toHaveLength(1);

      const entry = entries[0];
      expect(entry.email).toBe('user@test.com');
      expect(entry.role).toBe('tecnico');
      expect(entry.hash).toBeDefined();
      expect(entry.salt).toBeDefined();
      // Hash should NOT be the plaintext password
      expect(entry.hash).not.toBe('mypassword');
    });

    it('cacheCredential overwrites existing entry for same email', async () => {
      await cacheCredential('user@test.com', 'pass1', 'tecnico');
      await cacheCredential('user@test.com', 'pass2', 'tecnico');

      const storedRaw = store.get('offline_credentials');
      const entries = JSON.parse(storedRaw!);
      // Should have exactly 1 entry for user@test.com
      const userEntries = entries.filter((e: any) => e.email === 'user@test.com');
      expect(userEntries).toHaveLength(1);
    });
  });

  describe('credential verification', () => {
    it('verifyCredential returns role for correct password', async () => {
      await cacheCredential('user@test.com', 'correct-pass', 'admin');
      const role = await verifyCredential('user@test.com', 'correct-pass');
      expect(role).toBe('admin');
    });

    it('verifyCredential returns null for wrong password', async () => {
      await cacheCredential('user@test.com', 'correct-pass', 'admin');
      const role = await verifyCredential('user@test.com', 'wrong-pass');
      expect(role).toBeNull();
    });

    it('verifyCredential returns null for unknown email', async () => {
      const role = await verifyCredential('unknown@test.com', 'any-pass');
      expect(role).toBeNull();
    });
  });

  describe('credential clearing', () => {
    it('clearCredential removes entry for email', async () => {
      await cacheCredential('user@test.com', 'pass', 'tecnico');
      await clearCredential('user@test.com');
      const role = await verifyCredential('user@test.com', 'pass');
      expect(role).toBeNull();
    });
  });

  describe('full cycle', () => {
    it('online login caches -> offline verify succeeds -> clear removes -> verify fails', async () => {
      // Cache credentials (simulates successful online login)
      await cacheCredential('field@test.com', 'fieldpass', 'tecnico');

      // Verify succeeds with correct credentials
      expect(await verifyCredential('field@test.com', 'fieldpass')).toBe('tecnico');

      // Clear the credential
      await clearCredential('field@test.com');

      // Verify fails after clear
      expect(await verifyCredential('field@test.com', 'fieldpass')).toBeNull();
    });
  });

  describe('multi-user support', () => {
    it('multiple users can have cached credentials independently', async () => {
      await cacheCredential('user1@test.com', 'pass1', 'admin');
      await cacheCredential('user2@test.com', 'pass2', 'tecnico');

      expect(await verifyCredential('user1@test.com', 'pass1')).toBe('admin');
      expect(await verifyCredential('user2@test.com', 'pass2')).toBe('tecnico');

      await clearCredential('user1@test.com');

      expect(await verifyCredential('user1@test.com', 'pass1')).toBeNull();
      expect(await verifyCredential('user2@test.com', 'pass2')).toBe('tecnico');
    });
  });

  describe('TTL expiry', () => {
    it('isOfflineLoginExpired returns false when OFFLINE_LOGIN_EXPIRE is false', async () => {
      if (!OFFLINE_LOGIN_EXPIRE) {
        // Config says offline login never expires — verify this invariant
        await saveLastOnlineLogin();
        // Even if we never advance time, it should return false
        const result = await isOfflineLoginExpired();
        expect(result).toBe(false);
      } else {
        // OFFLINE_LOGIN_EXPIRE is true — test expiry behavior
        const fixedNow = 1000000;
        jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
        await saveLastOnlineLogin();

        // Advance past the TTL
        const pastTtl = fixedNow + OFFLINE_LOGIN_DURATION_HS * 3600 * 1000 + 1;
        jest.spyOn(Date, 'now').mockReturnValue(pastTtl);

        const result = await isOfflineLoginExpired();
        expect(result).toBe(true);
      }
    });

    it('isOfflineLoginExpired returns true when no last login recorded (OFFLINE_LOGIN_EXPIRE=true)', async () => {
      if (OFFLINE_LOGIN_EXPIRE) {
        // No saveLastOnlineLogin called — should be expired (never logged in online)
        const result = await isOfflineLoginExpired();
        expect(result).toBe(true);
      } else {
        // When expiry disabled, always returns false even without prior login
        const result = await isOfflineLoginExpired();
        expect(result).toBe(false);
      }
    });

    it('isOfflineLoginExpired returns false within TTL window when expiry enabled', async () => {
      if (OFFLINE_LOGIN_EXPIRE) {
        const fixedNow = 1000000;
        jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
        await saveLastOnlineLogin();

        // Advance by half the TTL
        const halfTtl = fixedNow + (OFFLINE_LOGIN_DURATION_HS * 3600 * 1000) / 2;
        jest.spyOn(Date, 'now').mockReturnValue(halfTtl);

        const result = await isOfflineLoginExpired();
        expect(result).toBe(false);
      } else {
        // Expiry disabled — always false regardless of time
        const result = await isOfflineLoginExpired();
        expect(result).toBe(false);
      }
    });
  });

  describe('getCachedEmails', () => {
    it('returns list of cached email addresses', async () => {
      await cacheCredential('a@test.com', 'p1', 'admin');
      await cacheCredential('b@test.com', 'p2', 'tecnico');
      const emails = await getCachedEmails();
      expect(emails).toEqual(['a@test.com', 'b@test.com']);
    });

    it('returns empty array when no credentials cached', async () => {
      const emails = await getCachedEmails();
      expect(emails).toEqual([]);
    });
  });
});
