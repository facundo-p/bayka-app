import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store');
jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('Role caching (offline-safe)', () => {
  it('readCachedSession does not query profiles table — ZERO supabase calls', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('token')
      .mockResolvedValueOnce('refresh');

    const { readCachedSession } = require('../../src/supabase/auth');
    const { supabase } = require('../../src/supabase/client');

    await readCachedSession();

    // profiles table must NOT be queried during cached session read
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
