import { useQueryClient } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { useInvalidarConListado } from './useInvalidarConListado';

/** Asignar o quitar un técnico cambia la card de la plantación y el listado,
 *  pero también el conteo de la pantalla de Usuarios y el panel de esa persona. */
export function useInvalidarAsignacion(plantationId: string, userId: string) {
  const queryClient = useQueryClient();
  const invalidarPlantacion = useInvalidarConListado(CLAVE_QUERY.plantacionUsuarios(plantationId));
  return () =>
    Promise.all([
      invalidarPlantacion(),
      queryClient.invalidateQueries({ queryKey: CLAVE_QUERY.usuarios() }),
      queryClient.invalidateQueries({ queryKey: CLAVE_QUERY.usuarioPlantaciones(userId) }),
    ]);
}
