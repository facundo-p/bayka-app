import { useCallback, useEffect, useState } from 'react';

export interface TreeSelection {
  id: string;
  /** Ids del grupo al momento de elegir: si aparece uno que no estaba, hubo un alta. */
  knownIds: ReadonlySet<string>;
}

type TreeWithId = { id: string };

/** La selección manual deja de valer si su árbol ya no existe o si se registró uno nuevo. */
export function isSelectionExpired(trees: readonly TreeWithId[], selection: TreeSelection): boolean {
  const stillExists = trees.some((t) => t.id === selection.id);
  const hadNewTree = trees.some((t) => !selection.knownIds.has(t.id));
  return !stillExists || hadNewTree;
}

/** `trees` en orden de posición ascendente: sin selección vigente, gana el último. */
export function resolveSelectedTreeId(
  trees: readonly TreeWithId[],
  selection: TreeSelection | null,
): string | null {
  if (selection && !isSelectionExpired(trees, selection)) return selection.id;
  return trees[trees.length - 1]?.id ?? null;
}

/**
 * Árbol seleccionado en la tira de la botonera. Por default el último; tocar un
 * chip lo fija hasta que se borra o se registra otro árbol. Invertir el orden no
 * la pierde: se conserva por id.
 */
export function useTreeSelection<T extends TreeWithId>(trees: readonly T[]) {
  const [selection, setSelection] = useState<TreeSelection | null>(null);

  // Una selección vencida se descarta: si no, deshacer el alta la resucitaría.
  useEffect(() => {
    if (selection && isSelectionExpired(trees, selection)) setSelection(null);
  }, [trees, selection]);

  const selectedId = resolveSelectedTreeId(trees, selection);
  const selectedTree = trees.find((t) => t.id === selectedId) ?? null;

  const select = useCallback((id: string) => {
    setSelection({ id, knownIds: new Set(trees.map((t) => t.id)) });
  }, [trees]);

  return { selectedTree, select };
}
