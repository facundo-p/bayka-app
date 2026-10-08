import { useEffect, useState } from 'react';
import { useCurrentUserId } from './useCurrentUserId';
import { readCachedRole } from '../supabase/auth';
import { esRolAdmin } from '../types/domain';
import type { QuienSube } from '../queries/pendingSyncQueries';

/** userId y rol cacheados, los mismos que usa el sync para decidir qué sube (#768). */
export function useQuienSube(): QuienSube {
  const userId = useCurrentUserId();
  const [esAdmin, setEsAdmin] = useState(false);
  useEffect(() => {
    let vigente = true;
    readCachedRole()
      .then((rol) => { if (vigente) setEsAdmin(esRolAdmin(rol)); })
      .catch(() => {});
    return () => { vigente = false; };
  }, []);
  return { userId, esAdmin };
}
