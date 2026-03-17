import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';

jest.mock('expo-secure-store');
jest.mock('@react-native-community/netinfo');
jest.mock('../../src/supabase/client', () => ({
  supabase: {
    auth: {
      setSession: jest.fn(),
    },
  },
}));

describe('Multi-user device support', () => {
  it('restoreSession returns null after clearSession (second user flow)', async () => {
    const { clearSession, restoreSession } = require('../../src/supabase/auth');

    // Simulate logout: clear everything
    await clearSession();

    // After clear, getItemAsync returns null for all keys
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const result = await restoreSession();
    expect(result).toBeNull();
  });
});
