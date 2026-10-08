import { colors } from '../theme';
import {
  showConfirmDialog,
  showDoubleConfirmDialog,
  showInfoDialog,
  type ShowFn,
} from '../utils/alertHelpers';
import type { UseTreeRegistrationResult } from './useTreeRegistration';

type Grupo = Pick<UseTreeRegistrationResult,
  'isReadOnly' | 'canReactivate' | 'totalCount' | 'unresolvedNN'
  | 'executeFinalize' | 'executeDeleteGroup' | 'executeReactivate' | 'executeReverseOrder'>;

const plural = (n: number, sufijo: string) => (n > 1 ? sufijo : '');

export function textoFinalizarGrupo(unresolvedNN: number): string {
  const nnWarn = unresolvedNN > 0
    ? ` Hay ${unresolvedNN} árbol${plural(unresolvedNN, 'es')} N/N sin resolver.\n      (deberan resolverse antes de sincronizar).`
    : '';
  return `Confirmar finalización? \n      ${nnWarn}`;
}

export function textoEliminarGrupo(totalCount: number): string {
  return totalCount > 0
    ? `Este grupo tiene ${totalCount} árbol${plural(totalCount, 'es')} cargado${plural(totalCount, 's')}. Esta acción no se puede deshacer.`
    : 'Esta acción no se puede deshacer.';
}

function finalizar(grupo: Grupo, show: ShowFn) {
  if (grupo.isReadOnly) return;
  if (grupo.totalCount === 0) {
    showInfoDialog(show, 'No se puede finalizar', 'No hay árboles cargados.',
      'information-circle-outline', colors.secondary);
    return;
  }
  showConfirmDialog(show, 'Finalizar grupo', textoFinalizarGrupo(grupo.unresolvedNN), 'Finalizar',
    () => grupo.executeFinalize(), { icon: 'checkmark-circle-outline', style: 'primary' });
}

function eliminar(grupo: Grupo, show: ShowFn) {
  if (grupo.isReadOnly) return;
  showDoubleConfirmDialog(show, 'Eliminar grupo', textoEliminarGrupo(grupo.totalCount), 'Confirmar eliminación',
    'Esta es la confirmación final. El grupo y todos sus árboles serán eliminados permanentemente.',
    () => grupo.executeDeleteGroup());
}

function reactivar(grupo: Grupo, show: ShowFn, grupoId: string | undefined) {
  if (!grupoId || !grupo.canReactivate) return;
  showConfirmDialog(show, 'Reactivar grupo',
    'Cambiar el estado del grupo a activa? Podrás registrar más árboles.',
    'Reactivar', async () => { await grupo.executeReactivate(); }, { icon: 'refresh-outline' });
}

function invertirOrden(grupo: Grupo, show: ShowFn) {
  if (grupo.isReadOnly) return;
  showConfirmDialog(show, 'Invertir Orden',
    'Invertir el orden de los árboles? Se recalcularán todas las posiciones y códigos.',
    'Invertir', () => grupo.executeReverseOrder(), { icon: 'swap-vertical-outline' });
}

/** Diálogos de las acciones sobre el grupo: finalizar, eliminar, reactivar e invertir el orden. */
export function useAccionesDeGrupo(grupo: Grupo, show: ShowFn, grupoId: string | undefined) {
  return {
    handleFinalizar: () => finalizar(grupo, show),
    handleDeleteGroup: () => eliminar(grupo, show),
    handleReactivate: () => reactivar(grupo, show, grupoId),
    handleReverseOrder: () => invertirOrden(grupo, show),
  };
}
