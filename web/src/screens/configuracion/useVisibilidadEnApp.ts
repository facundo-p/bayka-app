import type { Plantacion } from '../../queries/plantationQueries';
import { actualizarVisibilidad } from '../../repositories/plantationRepository';
import { useToggleConfigPlantacion } from './useToggleConfigPlantacion';

export function useVisibilidadEnApp(plantacion: Plantacion) {
  return useToggleConfigPlantacion({
    plantacionId: plantacion.id,
    valorInicial: plantacion.visibleInApp,
    guardar: actualizarVisibilidad,
    accion: 'actualizar la visibilidad',
  });
}
