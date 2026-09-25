import { useCallback } from 'react';
import { esRutaAdmin } from '../constants/rutas';
import { puedeEditarParcela } from '../utils/permisosDeEdicion';
import { useCurrentUserId } from './useCurrentUserId';

/** `puedeEditarParcela` con el editor de la sesión: rol por la ruta, userId cacheado. */
export function usePuedeEditarParcela(routePrefix: string): (parcela: { altaPendienteDe: string | null }) => boolean {
  const userId = useCurrentUserId();
  const esAdmin = esRutaAdmin(routePrefix);
  return useCallback((parcela) => puedeEditarParcela(parcela, { esAdmin, userId }), [esAdmin, userId]);
}
