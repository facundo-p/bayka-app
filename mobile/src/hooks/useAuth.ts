import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { restoreSession, persistSession, clearSession, ROLE_KEY, EMAIL_KEY } from '../supabase/auth';
import * as SecureStore from 'expo-secure-store';
import type { Role } from '../types/domain';

export function useAuth() {
  const [session, setSession] = useState<{ access_token: string; refresh_token: string } | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const restored = await restoreSession();
      if (mounted && restored) {
        setSession(restored);
        const cachedRole = await SecureStore.getItemAsync(ROLE_KEY);
        if (cachedRole) setRole(cachedRole as Role);
      }
      if (mounted) setLoading(false);
    })();

    // Listen for online auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, supabaseSession) => {
        if (event === 'SIGNED_IN' && supabaseSession) {
          await persistSession(supabaseSession);

          // Fetch role from profiles (online only — first login) and cache it
          const { data: profile } = await supabase
            .from('profiles')
            .select('rol')
            .eq('id', supabaseSession.user.id)
            .single();

          if (profile?.rol) {
            await SecureStore.setItemAsync(ROLE_KEY, profile.rol);
            await SecureStore.setItemAsync(EMAIL_KEY, supabaseSession.user.email ?? '');
            if (mounted) setRole(profile.rol as Role);
          }

          if (mounted) setSession(supabaseSession);

        } else if (event === 'SIGNED_OUT') {
          await clearSession();
          if (mounted) {
            setSession(null);
            setRole(null);
          }
        }
        // TOKEN_REFRESHED: handled by persistSession in restoreSession()
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    await supabase.auth.signOut();
    // clearSession() is called by SIGNED_OUT event handler above
  }

  return { session, role, loading, signIn, signOut };
}
