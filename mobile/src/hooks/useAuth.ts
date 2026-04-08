import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import { clearSession, restoreSession, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, ROLE_KEY, EMAIL_KEY } from '../supabase/auth';
import * as SecureStore from 'expo-secure-store';
import { cacheCredential, verifyCredential, saveLastOnlineLogin, isOfflineLoginExpired } from '../services/OfflineAuthService';
import type { Role } from '../types/domain';

export function useAuth() {
  const [session, setSession] = useState<{ access_token: string; refresh_token: string } | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const initializing = useRef(true);

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session from Supabase (it checks AsyncStorage internally)
    (async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (mounted && currentSession) {
          // Fetch role from SecureStore cache first
          let cachedRole = await SecureStore.getItemAsync(ROLE_KEY);

          // If no cached role, fetch from profiles
          if (!cachedRole) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('rol')
              .eq('id', currentSession.user.id)
              .single();
            if (profile?.rol) {
              cachedRole = profile.rol;
              await SecureStore.setItemAsync(ROLE_KEY, profile.rol);
              await SecureStore.setItemAsync(EMAIL_KEY, currentSession.user.email ?? '');
            }
          }

          if (mounted) {
            setSession(currentSession);
            if (cachedRole) setRole(cachedRole as Role);
          }
        }
      } catch (e) {
        console.error('[Auth] getSession failed:', e);
      } finally {
        initializing.current = false;
        if (mounted) setLoading(false);
      }
    })();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, supabaseSession) => {
        // Skip events during initialization — getSession handles that
        if (initializing.current) return;
        if (event === 'SIGNED_IN' && supabaseSession) {
          // Fetch role from profiles
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

          if (mounted) {
            setSession(supabaseSession);
            setLoading(false);
          }

        } else if (event === 'SIGNED_OUT') {
          await clearSession();
          if (mounted) {
            setSession(null);
            setRole(null);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleOfflineSignIn(email: string, password: string) {
    const expired = await isOfflineLoginExpired();
    if (expired) {
      return { data: { session: null, user: null }, error: { message: 'Sesion offline expirada. Conectate a internet para iniciar sesion.' } };
    }

    const cachedRole = await verifyCredential(email, password);
    if (!cachedRole) {
      return { data: { session: null, user: null }, error: { message: 'Sin conexion. Inicia sesion online primero.' } };
    }

    // Read tokens directly from SecureStore — no Supabase JWT validation needed offline
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!accessToken || !refreshToken) {
      return { data: { session: null, user: null }, error: { message: 'Sin conexion y sin sesion previa. Conectate al menos una vez.' } };
    }

    const offlineSession = { access_token: accessToken, refresh_token: refreshToken };
    setSession(offlineSession);
    setRole(cachedRole as Role);
    return { data: { session: offlineSession, user: null }, error: null };
  }

  async function signIn(email: string, password: string) {
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (!result.error && result.data.session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', result.data.session.user.id)
          .single();
        const userRole = profile?.rol ?? 'tecnico';
        await cacheCredential(email, password, userRole);
        await saveLastOnlineLogin();
      }
      return result;
    } catch (e: any) {
      if (e?.message?.includes('Network request failed')) {
        return handleOfflineSignIn(email, password);
      }
      throw e;
    }
  }

  async function signOut() {
    // 1. Clear local auth state first — guarantees sign-out even offline
    await clearSession();
    setSession(null);
    setRole(null);

    // 2. Best-effort Supabase cleanup (scope: 'local' avoids network calls)
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('[Auth] signOut exception (non-blocking):', e);
    }
    // NOTE: cached credentials are NOT cleared — they power quick-login chips
  }

  return { session, role, loading, signIn, signOut };
}
