/**
 * El ID de un árbol lleva el código de su parcela y de su grupo (#559): cambiarlo cambia los
 * IDs ya registrados. Antes de guardar se avisa cuántos, con su propio ConfirmModal para
 * renderizarlo dentro del modal del formulario.
 */
import { useCallback } from 'react';
import { colors } from '../theme';
import { useConfirm } from './useConfirm';

export type EntidadConCodigo = 'parcela' | 'grupo';

const DE_LA_ENTIDAD: Record<EntidadConCodigo, string> = {
  parcela: 'de esta parcela',
  grupo: 'de este grupo',
};

function mensajeDelAviso(arboles: number, entidad: EntidadConCodigo): string {
  const de = DE_LA_ENTIDAD[entidad];
  return arboles === 1
    ? `El ID del árbol ${de} se arma con su código: cambia. Si ya lo anotaste o exportaste, ese ID deja de coincidir.`
    : `Los IDs de los ${arboles} árboles ${de} se arman con su código: cambian todos. Si ya los anotaste o exportaste, esos IDs dejan de coincidir.`;
}

export function useAvisoCambioDeIds() {
  const confirm = useConfirm();
  const { show } = confirm;

  /** true = guardar. Sin árboles no hay nada que avisar. */
  const confirmarSiCambianIds = useCallback(
    (arboles: number, entidad: EntidadConCodigo): Promise<boolean> => {
      if (arboles === 0) return Promise.resolve(true);
      return new Promise((resolve) => {
        show({
          icon: 'alert-circle-outline',
          iconColor: colors.warningText,
          title: 'Cambian los IDs de los árboles',
          message: mensajeDelAviso(arboles, entidad),
          buttons: [
            { label: 'Cancelar', onPress: () => resolve(false), style: 'cancel' },
            { label: 'Cambiar código', onPress: () => resolve(true), style: 'primary' },
          ],
          onDismiss: () => resolve(false),
        });
      });
    },
    [show],
  );

  return { confirmarSiCambianIds, confirmProps: confirm.confirmProps };
}
