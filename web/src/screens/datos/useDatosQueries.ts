import { useQuery } from '@tanstack/react-query';
import { listarGrupos, listarParcelasConStats } from '../../queries/dataExplorerQueries';

/** Parcelas activas con stats; cache compartida entre las tres secciones de Datos. */
export function useParcelasDatos(plantationId: string) {
  return useQuery({
    queryKey: ['datos-parcelas', plantationId],
    queryFn: () => listarParcelasConStats(plantationId),
  });
}

/** Grupos de la plantación, opcionalmente acotados a una parcela ('' = todas). */
export function useGruposDatos(plantationId: string, parcelaId: string) {
  return useQuery({
    queryKey: ['datos-grupos', plantationId, parcelaId],
    queryFn: () => listarGrupos(plantationId, parcelaId ? { parcelaId } : {}),
  });
}
