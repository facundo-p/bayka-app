import type { Plantacion } from '../../queries/plantationQueries';
import { actualizarFotoEnTodos } from '../../repositories/plantationRepository';
import { useToggleConfigPlantacion } from './useToggleConfigPlantacion';

export function useFotoEnTodos(plantacion: Plantacion) {
  return useToggleConfigPlantacion({
    plantacionId: plantacion.id,
    valorInicial: plantacion.photoCaptureAllTrees,
    guardar: actualizarFotoEnTodos,
    accion: 'actualizar la foto en todos los botones',
  });
}
