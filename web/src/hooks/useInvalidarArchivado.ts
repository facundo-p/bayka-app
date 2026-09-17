import { useQueryClient } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { useInvalidarConListado } from './useInvalidarConListado';

/** Archivar cambia el detalle, el listado y la card "Temporada activa", que las excluye. */
export function useInvalidarArchivado(plantationId: string) {
  const queryClient = useQueryClient();
  const invalidarPlantacion = useInvalidarConListado(CLAVE_QUERY.plantacion(plantationId));
  return () =>
    Promise.all([
      invalidarPlantacion(),
      queryClient.invalidateQueries({ queryKey: CLAVE_QUERY.temporadaActiva() }),
    ]);
}
