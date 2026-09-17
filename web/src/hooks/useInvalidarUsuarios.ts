import { useQueryClient } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../queries/clavesQuery';

/** Las personas se leen en dos claves: `usuarios` (pantalla de Usuarios) y
 *  `perfiles` (nombres de técnico en Árboles y candidatos a asignar en
 *  Configuración). Un cambio en una persona tiene que llegar a las dos. */
export function useInvalidarUsuarios() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CLAVE_QUERY.usuarios() }),
      queryClient.invalidateQueries({ queryKey: CLAVE_QUERY.perfiles() }),
    ]);
}
