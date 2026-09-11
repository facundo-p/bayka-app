import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useInvalidarConListado } from '../../hooks/useInvalidarConListado';
import { mensajeErrorConocido } from '../../lib/mensajeErrorConocido';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import type { Plantacion } from '../../queries/plantationQueries';
import {
  actualizarVisibilidad,
  MENSAJE_VISIBILIDAD_SIN_MIGRACION,
} from '../../repositories/plantationRepository';

const ERROR_VISIBILIDAD = 'No se pudo actualizar la visibilidad.';

/** Guarda al cambiar, sin botón aparte: el toggle responde al instante y, si
 *  el update falla, vuelve al valor anterior. */
export function useVisibilidadEnApp(plantacion: Plantacion) {
  const [visible, setVisible] = useState(plantacion.visibleInApp);
  const invalidar = useInvalidarConListado(CLAVE_QUERY.plantacion(plantacion.id));
  const mutacion = useMutation({
    mutationFn: (nuevoValor: boolean) => actualizarVisibilidad(plantacion.id, nuevoValor),
    onSuccess: invalidar,
    onError: (_error, nuevoValor) => setVisible(!nuevoValor),
  });
  const cambiar = (nuevoValor: boolean) => {
    setVisible(nuevoValor);
    mutacion.mutate(nuevoValor);
  };
  const mensajeError = mensajeErrorConocido(
    mutacion.error,
    MENSAJE_VISIBILIDAD_SIN_MIGRACION,
    ERROR_VISIBILIDAD,
  );
  return { visible, cambiar, guardando: mutacion.isPending, mensajeError };
}
