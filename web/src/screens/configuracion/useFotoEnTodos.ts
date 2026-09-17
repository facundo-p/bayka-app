import type { Plantacion } from '../../queries/plantationQueries';
import {
  actualizarFotoEnTodos,
  MENSAJE_FOTO_SIN_MIGRACION,
} from '../../repositories/plantationRepository';
import { useToggleConfigPlantacion } from './useToggleConfigPlantacion';

export function useFotoEnTodos(plantacion: Plantacion) {
  return useToggleConfigPlantacion({
    plantacionId: plantacion.id,
    valorInicial: plantacion.photoCaptureAllTrees,
    guardar: actualizarFotoEnTodos,
    mensajeSinMigracion: MENSAJE_FOTO_SIN_MIGRACION,
    mensajeError: 'No se pudo actualizar la foto en todos los botones.',
  });
}
