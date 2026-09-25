/**
 * "Descartar" del aviso de pendientes varados (#638): confirma diciendo exactamente
 * qué se pierde y descarta. Lee todo de SQLite: anda sin conexión.
 */
import { useCallback } from 'react';
import { getDescarteDePlantacion } from '../queries/pendientesVaradosQueries';
import { descartarPendientes } from '../repositories/PendientesVaradosRepository';
import { showConfirmDialog, showDoubleConfirmDialog } from '../utils/alertHelpers';
import { confirmacionDeDescarte } from '../utils/avisoPendientesVarados';
import { colors } from '../theme';

type ShowFn = Parameters<typeof showConfirmDialog>[0];

export function useDescartarPendientes(show: ShowFn) {
  return useCallback(async (plantacionId: string) => {
    const descarte = await getDescarteDePlantacion(plantacionId);
    if (!descarte) return;
    const { titulo, mensaje, boton, confirmacionFinal } = confirmacionDeDescarte(descarte);
    const descartar = () => descartarPendientes(plantacionId);
    // Si la saca del dispositivo, la misma doble confirmación que "Eliminar del dispositivo".
    if (confirmacionFinal) {
      showDoubleConfirmDialog(show, titulo, mensaje, boton, confirmacionFinal, descartar);
      return;
    }
    showConfirmDialog(show, titulo, mensaje, boton, descartar, {
      icon: 'warning-outline',
      iconColor: colors.danger,
      style: 'danger',
    });
  }, [show]);
}
