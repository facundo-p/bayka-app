import { useCallback } from 'react';
import { useRouter } from 'expo-router';

/**
 * Handler de "atrás" unificado para la flecha del header y el back del SO.
 *
 * Hace pop real del stack (`router.back`) cuando hay historial, de modo que el
 * botón de hardware/gesto de Android y la flecha del header coincidan con la
 * navegación que el usuario realmente hizo. Antes los headers usaban
 * `router.navigate(destinoFijo)`, que no hace pop: dejaba pantallas colgadas en
 * el stack `plantation` (p.ej. `catalog`) y el back del SO caía ahí.
 *
 * `fallbackHref` solo se usa cuando no hay historial (entrada directa/deep-link).
 */
export function useGoBack(fallbackHref: string) {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.navigate(fallbackHref as never);
  }, [router, fallbackHref]);
}
