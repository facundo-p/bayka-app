import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import * as SecureStore from 'expo-secure-store';

export const USER_ID_KEY = 'user_id';

export function useCurrentUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      // SecureStore first — always works, even offline
      const cached = await SecureStore.getItemAsync(USER_ID_KEY);
      if (cached) {
        setUserId(cached);
        return;
      }
      // Fallback: try Supabase session (only if SecureStore empty, e.g. first login)
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user?.id) {
          setUserId(data.session.user.id);
          await SecureStore.setItemAsync(USER_ID_KEY, data.session.user.id);
        }
      } catch {
        // Offline and no cached userId — nothing we can do
      }
    })();
  }, []);
  return userId;
}
