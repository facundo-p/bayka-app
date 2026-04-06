// Mock @react-native-async-storage/async-storage (required by supabase client)
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  mergeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
  multiMerge: jest.fn(),
  flushGetRequests: jest.fn(),
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substring(2, 10)),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_alg: string, data: string) => `mock-hash-${data}`),
  getRandomBytes: jest.fn((n: number) => new Uint8Array(n).fill(42)),
}));

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
  })),
}));

// Mock drizzle-orm/expo-sqlite to avoid native module issues in tests
jest.mock('drizzle-orm/expo-sqlite', () => ({
  drizzle: jest.fn(() => ({})),
}));
