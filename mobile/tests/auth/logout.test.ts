import * as SecureStore from 'expo-secure-store';
jest.mock('expo-secure-store');
jest.mock('../../src/supabase/client', () => ({
  supabase: {
    auth: {
      setSession: jest.fn(),
    },
  },
}));

const { clearSession } = require('../../src/supabase/auth');

describe('clearSession', () => {
  it('deletes session keys from SecureStore but keeps last_email', async () => {
    await clearSession();

    const deletedKeys = (SecureStore.deleteItemAsync as jest.Mock).mock.calls.map(c => c[0]);
    expect(deletedKeys).toContain('supabase_access_token');
    expect(deletedKeys).toContain('supabase_refresh_token');
    expect(deletedKeys).toContain('user_role');
    // last_email intentionally kept — pre-fills login screen after logout
    expect(deletedKeys).not.toContain('last_email');
  });
});
