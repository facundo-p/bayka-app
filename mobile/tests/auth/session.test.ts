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

const { restoreSession, clearSession } = require('../../src/supabase/auth');
const { supabase } = require('../../src/supabase/client');

describe('restoreSession', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when SecureStore has no tokens', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    const result = await restoreSession();
    expect(result).toBeNull();
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
  });

  it('returns cached tokens without network call when offline', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('access-token-123')
      .mockResolvedValueOnce('refresh-token-456');
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });

    const result = await restoreSession();

    expect(result).toEqual({ access_token: 'access-token-123', refresh_token: 'refresh-token-456' });
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
  });

  it('calls setSession and returns refreshed session when online', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('old-access')
      .mockResolvedValueOnce('old-refresh');
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
    (supabase.auth.setSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: 'new-access', refresh_token: 'new-refresh' } },
      error: null,
    });

    const result = await restoreSession();

    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'old-access',
      refresh_token: 'old-refresh',
    });
    expect(result).toMatchObject({ access_token: 'new-access' });
  });

  it('clears SecureStore and returns null when online setSession returns error', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('expired-access')
      .mockResolvedValueOnce('expired-refresh');
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
    (supabase.auth.setSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: { message: 'Token expired' },
    });

    const result = await restoreSession();

    expect(result).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });
});
