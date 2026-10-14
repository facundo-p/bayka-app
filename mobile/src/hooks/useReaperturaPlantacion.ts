/**
 * Reabrir una plantación finalizada desde el bottom sheet (#637): solo online,
 * con la misma confirmación que la web.
 */
import { showInfoDialog } from '../utils/alertHelpers';
import { hayConexion } from '../services/conexion';
import { reabrirPlantacion, ReabrirPlantacionLocalSyncError } from '../repositories/PlantationRepository';
import {
  AYUDA_REABRIR_SIN_CONEXION,
  CONFIRMACION_REAPERTURA,
  esReabrible,
  mensajeConfirmacionReapertura,
} from '../utils/reaperturaPlantacion';
import { colors } from '../theme';
import type { useConfirm } from './useConfirm';
import type { Plantation } from '../types/plantation';

type ShowConfirm = ReturnType<typeof useConfirm>['show'];

export function useReaperturaPlantacion(showConfirm: ShowConfirm) {
  async function reabrirConfirmado(plantacionId: string) {
    try {
      await reabrirPlantacion(plantacionId);
    } catch (e: any) {
      if (e instanceof ReabrirPlantacionLocalSyncError) {
        showInfoDialog(showConfirm, 'Plantación reabierta', 'La plantación se reabrió en el servidor. Este dispositivo se actualizará en la próxima sincronización.', 'cloud-done-outline', colors.info);
      } else {
        showInfoDialog(showConfirm, 'No se pudo reabrir', e?.message, 'alert-circle-outline', colors.danger);
      }
    }
  }

  async function handleReopen(plantation: Plantation) {
    if (!esReabrible(plantation)) return;
    if (!(await hayConexion())) {
      showInfoDialog(showConfirm, 'Sin conexión', `${AYUDA_REABRIR_SIN_CONEXION}.`, 'wifi-outline', colors.info);
      return;
    }
    showConfirm({
      icon: 'lock-open-outline',
      iconColor: colors.primary,
      title: CONFIRMACION_REAPERTURA.titulo(plantation.lugar),
      message: mensajeConfirmacionReapertura(plantation.lugar),
      buttons: [
        { label: 'Cancelar', style: 'cancel', onPress: () => {} },
        { label: CONFIRMACION_REAPERTURA.etiqueta, style: 'primary', icon: 'lock-open-outline', onPress: () => reabrirConfirmado(plantation.id) },
      ],
    });
  }

  return { handleReopen };
}
