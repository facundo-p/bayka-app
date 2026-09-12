import type { Plantacion } from '../../queries/plantationQueries';
import {
  actualizarVisibilidad,
  MENSAJE_VISIBILIDAD_SIN_MIGRACION,
} from '../../repositories/plantationRepository';
import { useToggleConfigPlantacion } from './useToggleConfigPlantacion';

export function useVisibilidadEnApp(plantacion: Plantacion) {
  return useToggleConfigPlantacion({
    plantacionId: plantacion.id,
    valorInicial: plantacion.visibleInApp,
    guardar: actualizarVisibilidad,
    mensajeSinMigracion: MENSAJE_VISIBILIDAD_SIN_MIGRACION,
    mensajeError: 'No se pudo actualizar la visibilidad.',
  });
}
