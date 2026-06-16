import { useLiveData } from '../database/liveQuery';
import { getTreeDetail } from '../queries/treeQueries';

export type TreeDetail = Awaited<ReturnType<typeof getTreeDetail>>[number];

/**
 * Detalle reactivo de un árbol (especie + científico + foto + GPS).
 * Devuelve null mientras no haya treeId o no exista el árbol.
 */
export function useTreeDetail(treeId: string | null) {
  const { data } = useLiveData(
    () => (treeId ? getTreeDetail(treeId) : Promise.resolve([])),
    [treeId],
  );
  return (data?.[0] as TreeDetail | undefined) ?? null;
}
