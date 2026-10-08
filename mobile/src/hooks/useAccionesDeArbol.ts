import { colors } from '../theme';
import { showConfirmDialog, showInfoDialog, type ShowFn } from '../utils/alertHelpers';
import type { UseTreeRegistrationResult } from './useTreeRegistration';

type Grupo = Pick<UseTreeRegistrationResult,
  'isReadOnly' | 'sortedTrees' | 'undoLast' | 'executeDeleteTree' | 'captureTreeGps'>;

type ArbolDeLaTira = { id: string; posicion: number; latitude?: number | null };

export function textoSinSenalGps(teniaPunto: boolean): string {
  return teniaPunto
    ? 'No se pudo obtener un punto. El punto anterior se conserva; probá de nuevo cuando mejore la señal.'
    : 'No se pudo obtener un punto. Probá de nuevo cuando mejore la señal.';
}

async function capturarGps(grupo: Grupo, show: ShowFn, arbol: ArbolDeLaTira | null) {
  if (!arbol) return;
  const hadPoint = arbol.latitude != null;
  const captured = await grupo.captureTreeGps(arbol.id);
  if (!captured) {
    showInfoDialog(show, 'Sin señal GPS', textoSinSenalGps(hadPoint), 'locate-outline', colors.secondary);
  }
}

function eliminarArbol(grupo: Grupo, show: ShowFn, treeId: string, posicion: number) {
  if (grupo.isReadOnly) return;
  showConfirmDialog(show, 'Eliminar árbol',
    `Eliminar el árbol en posición ${posicion}? Las posiciones se recalcularán automáticamente.`,
    'Eliminar', () => grupo.executeDeleteTree(treeId),
    { icon: 'trash-outline', iconColor: colors.danger, style: 'danger' });
}

// El último se deshace al instante, como siempre. Uno del medio renumera a los
// que siguen: pasa por la confirmación.
function eliminarDeLaTira(grupo: Grupo, show: ShowFn, arbol: ArbolDeLaTira) {
  const isLast = arbol.id === grupo.sortedTrees[grupo.sortedTrees.length - 1]?.id;
  if (isLast) void grupo.undoLast();
  else eliminarArbol(grupo, show, arbol.id, arbol.posicion);
}

/** Acciones sobre un árbol del grupo: GPS del seleccionado y borrado desde la tira, la lista o el detalle. */
export function useAccionesDeArbol(grupo: Grupo, show: ShowFn, seleccionado: ArbolDeLaTira | null) {
  return {
    handleCaptureGps: () => capturarGps(grupo, show, seleccionado),
    handleDeleteSelected: (arbol: ArbolDeLaTira) => eliminarDeLaTira(grupo, show, arbol),
    handleDeleteTree: (treeId: string, posicion: number) => eliminarArbol(grupo, show, treeId, posicion),
  };
}
