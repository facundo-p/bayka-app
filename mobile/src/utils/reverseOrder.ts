export interface TreePositionEntry {
  id: string;
  posicion: number;
}

export interface ReversedPosition {
  id: string;
  newPosicion: number;
}

/**
 * Computes reversed positions for all trees in a Group.
 * Formula: newPosicion = total - oldPosicion + 1 (position 1 becomes N, N becomes 1).
 */
export function computeReversedPositions(
  treeList: TreePositionEntry[]
): ReversedPosition[] {
  const total = treeList.length;
  return treeList.map((t) => ({
    id: t.id,
    newPosicion: total - t.posicion + 1,
  }));
}
