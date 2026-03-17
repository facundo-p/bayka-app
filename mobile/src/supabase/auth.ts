import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './client';

// Separate keys to stay under expo-secure-store's 2048-byte limit (Pitfall 4)
const ACCESS_TOKEN_KEY = 'supabase_access_token';
const REFRESH_TOKEN_KEY = 'supabase_refresh_token';
const ROLE_KEY = 'user_role';
const EMAIL_KEY = 'last_email';

export { ROLE_KEY, EMAIL_KEY };

export async function persistSession(session: {
  access_token: string;
  refresh_token: string;
}): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.access_token);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refresh_token);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(ROLE_KEY);
  await SecureStore.deleteItemAsync(EMAIL_KEY);
}

export async function restoreSession(): Promise<{ access_token: string; refresh_token: string } | null> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

  if (!accessToken || !refreshToken) return null;

  const net = await NetInfo.fetch();

  if (!net.isConnected) {
    // Offline: return cached tokens without attempting network refresh (Pitfall 1)
    // The Supabase client will use these tokens as-is for offline operation
    return { access_token: accessToken, refresh_token: refreshToken };
  }

  // Online: validate and refresh via Supabase
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    // Token unrecoverable — clear and force re-login
    await clearSession();
    return null;
  }

  // Persist refreshed tokens
  await persistSession(data.session);
  return data.session;
}
