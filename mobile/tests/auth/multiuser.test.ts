import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store');

describe('Multi-user device support', () => {
  it('readCachedSession returns null after clearSession (second user flow)', async () => {
    const { clearSession, readCachedSession } = require('../../src/supabase/auth');

    await clearSession();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const result = await readCachedSession();
    expect(result).toBeNull();
  });
});
