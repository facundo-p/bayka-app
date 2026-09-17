import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../queries/clavesQuery';

/** Invalida `clave` y el listado de plantaciones, cuyos badges y stats
 *  (estado, visibilidad, técnicos) dependen de lo que se acaba de guardar.
 *  Sin `clave`, solo el listado. */
export function useInvalidarConListado(clave?: QueryKey) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CLAVE_QUERY.plantaciones() }),
      clave && queryClient.invalidateQueries({ queryKey: clave }),
    ]);
}
