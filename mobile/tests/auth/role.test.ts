import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';

jest.mock('expo-secure-store');
jest.mock('@react-native-community/netinfo');
jest.mock('../../src/supabase/client', () => ({
  supabase: {
    auth: {
      setSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(),
  },
}));

describe('Role caching (offline-safe)', () => {
  it('restoreSession does not query profiles table — role comes from SecureStore only', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('token')
      .mockResolvedValueOnce('refresh');
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });

    const { restoreSession } = require('../../src/supabase/auth');
    const { supabase } = require('../../src/supabase/client');

    await restoreSession();

    // profiles table must NOT be queried during session restore
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
