import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useInvalidarConListado } from '../../hooks/useInvalidarConListado';
import { RUTA } from '../../lib/rutas';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import {
  eliminarPlantacion,
  type ResultadoEliminacion,
} from '../../services/adminPlantacionesService';

/**
 * Ejecuta el borrado y, al cerrar el resultado, vuelve al listado. El detalle
 * no se invalida antes de cerrar: su refetch devolvería "no encontrada" y
 * desmontaría el modal con el aviso de fotos pendientes.
 */
export function useEliminarPlantacion(plantacionId: string, onClose: () => void) {
  const [resultado, setResultado] = useState<ResultadoEliminacion | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const invalidarListado = useInvalidarConListado();
  const eliminar = async (nombreConfirmacion?: string) =>
    setResultado(await eliminarPlantacion(plantacionId, nombreConfirmacion));
  const alCompletar = () =>
    Promise.all([
      invalidarListado(),
      queryClient.invalidateQueries({ queryKey: CLAVE_QUERY.temporadaActiva() }),
    ]);
  const cerrar = () => {
    if (!resultado) return onClose();
    void navigate(RUTA.plantaciones);
    queryClient.removeQueries({ queryKey: CLAVE_QUERY.plantacion(plantacionId) });
  };
  return { resultado, eliminar, alCompletar, cerrar };
}
