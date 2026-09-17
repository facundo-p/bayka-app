import { useQuery } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { listarPerfiles } from '../queries/usuarioQueries';

/** Todos los perfiles, inactivos incluidos. */
export function usePerfiles() {
  return useQuery({ queryKey: CLAVE_QUERY.perfiles(), queryFn: listarPerfiles });
}
