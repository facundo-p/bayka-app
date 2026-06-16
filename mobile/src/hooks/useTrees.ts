import { useLiveData } from '../database/liveQuery';
import { getTreesForGroup } from '../queries/treeQueries';

export function useTrees(grupoId: string) {
  const { data } = useLiveData(() => getTreesForGroup(grupoId), [grupoId]);
  const allTrees = data ?? [];
  const lastThree = allTrees.slice(0, 3);
  const totalCount = allTrees.length;
  const unresolvedNN = allTrees.filter((t) => t.especieId === null).length;
  return { allTrees, lastThree, totalCount, unresolvedNN };
}
