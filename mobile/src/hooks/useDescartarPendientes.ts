/**
 * "Descartar" del aviso de pendientes varados (#638): confirma diciendo exactamente
 * qué se pierde y descarta. Lee todo de SQLite: anda sin conexión.
 */
import { useCallback } from 'react';
import { getDescarteDePlantacion } from '../queries/pendientesVaradosQueries';
import { descartarPendientes } from '../repositories/PendientesVaradosRepository';
import { showConfirmDialog } from '../utils/alertHelpers';
import { confirmacionDeDescarte } from '../utils/avisoPendientesVarados';
import { colors } from '../theme';

type ShowFn = Parameters<typeof showConfirmDialog>[0];

export function useDescartarPendientes(show: ShowFn) {
  return useCallback(async (plantacionId: string) => {
    const descarte = await getDescarteDePlantacion(plantacionId);
    if (!descarte) return;
    const { titulo, mensaje, boton } = confirmacionDeDescarte(descarte);
    showConfirmDialog(show, titulo, mensaje, boton, () => descartarPendientes(plantacionId), {
      icon: 'warning-outline',
      iconColor: colors.danger,
      style: 'danger',
    });
  }, [show]);
}
