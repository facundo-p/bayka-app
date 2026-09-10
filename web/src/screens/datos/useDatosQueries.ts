import { useQuery } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { listarGrupos, listarParcelasConStats } from '../../queries/dataExplorerQueries';

/** Parcelas activas con stats; cache compartida entre las secciones de Datos y el Dashboard. */
export function useParcelasDatos(plantationId: string) {
  return useQuery({
    queryKey: CLAVE_QUERY.datosParcelas(plantationId),
    queryFn: () => listarParcelasConStats(plantationId),
  });
}

/** Grupos de la plantación, opcionalmente acotados a una parcela ('' = todas). */
export function useGruposDatos(plantationId: string, parcelaId: string) {
  return useQuery({
    queryKey: CLAVE_QUERY.datosGrupos(plantationId, parcelaId),
    queryFn: () => listarGrupos(plantationId, parcelaId ? { parcelaId } : {}),
  });
}
