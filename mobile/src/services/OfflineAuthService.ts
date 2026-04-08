import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { OFFLINE_LOGIN_EXPIRE, OFFLINE_LOGIN_DURATION_HS } from '../config/offlineLogin';

const OFFLINE_CREDENTIALS_KEY = 'offline_credentials';
const SAVED_ACCOUNTS_KEY = 'saved_accounts';
const LAST_ONLINE_LOGIN_KEY = 'last_online_login';

type OfflineCredential = {
  email: string;
  hash: string;
  salt: string;
  role: string;
  /** Encrypted by OS Keychain via SecureStore — powers 1-tap quick login */
  password?: string;
};

async function getAll(): Promise<OfflineCredential[]> {
  const raw = await SecureStore.getItemAsync(OFFLINE_CREDENTIALS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password + salt,
  );
}

export async function cacheCredential(
  email: string,
  password: string,
  role: string,
): Promise<void> {
  const saltBytes = Crypto.getRandomBytes(32);
  const salt = bytesToHex(saltBytes);
  const hash = await hashPassword(password, salt);

  const all = await getAll();
  const idx = all.findIndex((c) => c.email === email);
  const entry: OfflineCredential = { email, hash, salt, role, password };

  if (idx >= 0) {
    all[idx] = entry;
  } else {
    all.push(entry);
  }

  await SecureStore.setItemAsync(
    OFFLINE_CREDENTIALS_KEY,
    JSON.stringify(all),
  );
}

export async function verifyCredential(
  email: string,
  password: string,
): Promise<string | null> {
  const all = await getAll();
  const entry = all.find((c) => c.email === email);
  if (!entry) return null;

  const hash = await hashPassword(password, entry.salt);
  return hash === entry.hash ? entry.role : null;
}

export async function clearCredential(email: string): Promise<void> {
  const all = await getAll();
  const filtered = all.filter((c) => c.email !== email);
  await SecureStore.setItemAsync(
    OFFLINE_CREDENTIALS_KEY,
    JSON.stringify(filtered),
  );
}

export async function getCachedEmails(): Promise<string[]> {
  const all = await getAll();
  // Lazy migration: delete old plaintext saved_accounts key
  await SecureStore.deleteItemAsync(SAVED_ACCOUNTS_KEY);
  return all.map((c) => c.email);
}

export async function getCachedPassword(email: string): Promise<string | null> {
  const all = await getAll();
  return all.find((c) => c.email === email)?.password ?? null;
}

export async function saveLastOnlineLogin(): Promise<void> {
  await SecureStore.setItemAsync(LAST_ONLINE_LOGIN_KEY, Date.now().toString());
}

export async function isOfflineLoginExpired(): Promise<boolean> {
  if (!OFFLINE_LOGIN_EXPIRE) return false;

  const raw = await SecureStore.getItemAsync(LAST_ONLINE_LOGIN_KEY);
  if (!raw) return true; // never logged in online

  const lastLogin = parseInt(raw, 10);
  const elapsed = Date.now() - lastLogin;
  const ttlMs = OFFLINE_LOGIN_DURATION_HS * 60 * 60 * 1000;
  return elapsed > ttlMs;
}
