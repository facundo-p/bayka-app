import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store');

const { readCachedSession, clearSession } = require('../../src/supabase/auth');

describe('readCachedSession', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when SecureStore has no tokens', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    const result = await readCachedSession();
    expect(result).toBeNull();
  });

  it('returns cached tokens from SecureStore (works offline)', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('access-token-123')
      .mockResolvedValueOnce('refresh-token-456');

    const result = await readCachedSession();

    expect(result).toEqual({ access_token: 'access-token-123', refresh_token: 'refresh-token-456' });
  });

  it('returns null if only access_token exists (no refresh_token)', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('access-token-123')
      .mockResolvedValueOnce(null);

    const result = await readCachedSession();
    expect(result).toBeNull();
  });

  it('makes ZERO network calls — pure SecureStore read', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('access')
      .mockResolvedValueOnce('refresh');

    await readCachedSession();

    // Only SecureStore reads, nothing else
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(2);
  });
});
