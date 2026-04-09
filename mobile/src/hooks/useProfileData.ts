import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';

export type CachedProfile = {
  nombre: string;
  email: string;
  rol: string;
  organizacionId: string;
  organizacionNombre: string;
};

const PROFILE_CACHE_KEY = 'user_profile_cache';

export function useProfileData() {
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Step 1: Load cache immediately — always works
      try {
        const cached = await SecureStore.getItemAsync(PROFILE_CACHE_KEY);
        if (cached && mounted) {
          setProfile(JSON.parse(cached));
        }
      } catch {}

      // Step 2: Only fetch from Supabase if online
      const net = await NetInfo.fetch();
      if (net.isConnected === false) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mounted) { setLoading(false); return; }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('nombre, rol, organizacion_id, organizations(nombre)')
          .eq('id', user.id)
          .single();

        if (!profileData || !mounted) { setLoading(false); return; }

        const orgRaw = profileData.organizations as unknown as { nombre: string } | { nombre: string }[] | null;
        const orgData = Array.isArray(orgRaw) ? orgRaw[0] ?? null : orgRaw;

        const fresh: CachedProfile = {
          nombre: profileData.nombre ?? '',
          email: user.email ?? '',
          rol: profileData.rol ?? '',
          organizacionId: profileData.organizacion_id ?? '',
          organizacionNombre: orgData?.nombre ?? '',
        };

        if (mounted) setProfile(fresh);
        await SecureStore.setItemAsync(PROFILE_CACHE_KEY, JSON.stringify(fresh));
      } catch {
        // Offline or error — cached data (if any) already set
      }

      if (mounted) setLoading(false);
    })();

    return () => { mounted = false; };
  }, []);

  return { profile, loading };
}
