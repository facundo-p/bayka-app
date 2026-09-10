import { useQuery } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { obtenerPlantacion } from '../queries/plantationQueries';

/** Detalle de una plantación; el shell y sus tabs comparten la cache. Sin id
 *  (la ruta todavía no lo resolvió) queda pendiente en vez de pedir `''`. */
export function usePlantacion(plantationId: string) {
  return useQuery({
    queryKey: CLAVE_QUERY.plantacion(plantationId),
    queryFn: () => obtenerPlantacion(plantationId),
    enabled: Boolean(plantationId),
  });
}
