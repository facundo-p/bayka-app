import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase/client';

export function useCurrentUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // getSession() reads from local AsyncStorage — works offline.
    // getUser() validates the JWT with the server and fails when offline.
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.id) setUserId(data.session.user.id);
    });
  }, []);
  return userId;
}
