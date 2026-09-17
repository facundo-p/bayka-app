import { useQuery } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { listarCatalogo } from '../queries/especieQueries';

/** Catálogo global de especies, sin conteos de uso. */
export function useCatalogoEspecies() {
  return useQuery({ queryKey: CLAVE_QUERY.especiesCatalogo(), queryFn: listarCatalogo });
}
