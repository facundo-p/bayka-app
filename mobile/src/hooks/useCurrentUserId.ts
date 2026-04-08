import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import * as SecureStore from 'expo-secure-store';

export const USER_ID_KEY = 'user_id';

export function useCurrentUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      // Try Supabase session first (works when session is in AsyncStorage)
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user?.id) {
        setUserId(data.session.user.id);
        return;
      }
      // Fallback: read from SecureStore (offline re-login path)
      const cached = await SecureStore.getItemAsync(USER_ID_KEY);
      if (cached) setUserId(cached);
    })();
  }, []);
  return userId;
}
