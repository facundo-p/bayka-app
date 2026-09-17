/**
 * "Eliminar del dispositivo", compartido por la lista local y el catálogo. Lee todo de
 * SQLite: tiene que andar aunque la plantación ya no esté en el catálogo del server (#478).
 */
import { useCallback } from 'react';
import { getPlantacionParaEliminarDelDispositivo, getResumenDePendientes } from '../queries/catalogQueries';
import { deletePlantationLocally } from '../repositories/PlantationRepository';
import { showConfirmDialog, showDoubleConfirmDialog } from '../utils/alertHelpers';
import { avisoEliminarDelDispositivo } from '../utils/avisoEliminarDelDispositivo';
import { esEliminadaEnServidor } from '../constants/estados';
import { colors } from '../theme';

type ShowFn = Parameters<typeof showConfirmDialog>[0];

export function useEliminarDelDispositivo(show: ShowFn) {
  return useCallback(async (plantacionId: string) => {
    const plantacion = await getPlantacionParaEliminarDelDispositivo(plantacionId);
    if (!plantacion) return;
    const aviso = avisoEliminarDelDispositivo({
      lugar: plantacion.lugar,
      eliminada: esEliminadaEnServidor(plantacion),
      resumen: await getResumenDePendientes(plantacionId),
    });
    const eliminar = () => deletePlantationLocally(plantacionId);
    if (aviso.confirmacionFinal) {
      showDoubleConfirmDialog(show, aviso.titulo, aviso.mensaje, 'Eliminar de todas formas', aviso.confirmacionFinal, eliminar);
      return;
    }
    showConfirmDialog(show, aviso.titulo, aviso.mensaje, 'Eliminar', eliminar, {
      icon: 'trash-outline',
      iconColor: colors.danger,
      style: 'danger',
    });
  }, [show]);
}
