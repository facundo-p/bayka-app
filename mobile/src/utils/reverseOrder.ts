export interface TreePositionEntry {
  id: string;
  posicion: number;
}

export interface ReversedPosition {
  id: string;
  newPosicion: number;
}

/**
 * Computes reversed positions for all trees in a SubGroup.
 * Formula: newPosicion = total - oldPosicion + 1
 * A tree at position 1 becomes position N; position N becomes 1.
 * Returns same array length, empty if input is empty.
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
