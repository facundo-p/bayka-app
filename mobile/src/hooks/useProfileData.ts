import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { readCachedUserId } from '../supabase/auth';
import { hayConexion } from '../services/conexion';
import { leerPerfilCacheado, guardarPerfilCacheado, type CachedProfile } from '../services/PerfilCacheadoService';

export type { CachedProfile };

export function useProfileData() {
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Step 1: Load cache immediately — always works
      try {
        const cached = await leerPerfilCacheado();
        if (cached && mounted) setProfile(cached);
      } catch {}

      // Step 2: Only fetch from Supabase if online
      if (!(await hayConexion())) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        // Una sesión del SDK de otra cuenta no pisa el perfil de quien está logueado (#658).
        if (!user || !mounted || user.id !== (await readCachedUserId())) { setLoading(false); return; }

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
        await guardarPerfilCacheado(user.id, fresh);
      } catch {
        // Offline or error — cached data (if any) already set
      }

      if (mounted) setLoading(false);
    })();

    return () => { mounted = false; };
  }, []);

  return { profile, loading };
}
