import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import { clearSession, restoreSession, ROLE_KEY, EMAIL_KEY } from '../supabase/auth';
import NetInfo from '@react-native-community/netinfo';
import * as SecureStore from 'expo-secure-store';
import { cacheCredential, verifyCredential, clearCredential } from '../services/OfflineAuthService';
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
    const cachedRole = await verifyCredential(email, password);
    if (!cachedRole) {
      return { data: { session: null, user: null }, error: { message: 'Sin conexion. Inicia sesion online primero.' } };
    }
    const restoredSession = await restoreSession();
    if (!restoredSession) {
      return { data: { session: null, user: null }, error: { message: 'Sin conexion y sin sesion previa. Conectate al menos una vez.' } };
    }
    setSession(restoredSession);
    setRole(cachedRole as Role);
    return { data: { session: restoredSession, user: null }, error: null };
  }

  async function signIn(email: string, password: string) {
    const net = await NetInfo.fetch();
    const isOnline = net.isConnected === true && net.isInternetReachable !== false;

    if (!isOnline) {
      return handleOfflineSignIn(email, password);
    }

    const result = await supabase.auth.signInWithPassword({ email, password });
    if (!result.error && result.data.session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', result.data.session.user.id)
        .single();
      const userRole = profile?.rol ?? 'tecnico';
      await cacheCredential(email, password, userRole);
    }
    return result;
  }

  async function signOut() {
    const currentEmail = await SecureStore.getItemAsync(EMAIL_KEY);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[Auth] signOut exception:', e);
    }
    await clearSession();
    if (currentEmail) {
      await clearCredential(currentEmail);
    }
    setSession(null);
    setRole(null);
  }

  return { session, role, loading, signIn, signOut };
}
