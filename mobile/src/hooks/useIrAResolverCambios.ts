import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useRoutePrefix } from './useRoutePrefix';

/** Abre "Resolver cambios" de una plantación (#634). */
export function useIrAResolverCambios() {
  const router = useRouter();
  const routePrefix = useRoutePrefix();
  return useCallback(
    (plantacionId: string) => router.push(`/${routePrefix}/plantation/resolver-cambios?plantacionId=${plantacionId}` as any),
    [router, routePrefix],
  );
}
