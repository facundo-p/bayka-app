import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useInvalidarConListado } from '../../hooks/useInvalidarConListado';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { mensajeDeErrorDeEdicion } from '../../repositories/edicionDePlantacion';

interface ToggleConfigPlantacion {
  plantacionId: string;
  valorInicial: boolean;
  guardar: (plantacionId: string, valor: boolean) => Promise<void>;
  /** Acción en infinitivo para el mensaje de cualquier otro error: "actualizar la visibilidad". */
  accion: string;
}

/**
 * Toggle booleano de la plantación que guarda al cambiar, sin botón aparte: responde al
 * instante y, si el guardado falla, vuelve al valor anterior. Un booleano no puede chocar:
 * la base es el opuesto, así que el server tiene uno de los dos valores que la RPC acepta.
 */
export function useToggleConfigPlantacion({
  plantacionId,
  valorInicial,
  guardar,
  accion,
}: ToggleConfigPlantacion) {
  const [activo, setActivo] = useState(valorInicial);
  const invalidar = useInvalidarConListado(CLAVE_QUERY.plantacion(plantacionId));
  const mutacion = useMutation({
    mutationFn: (nuevoValor: boolean) => guardar(plantacionId, nuevoValor),
    onSuccess: invalidar,
    onError: (_error, nuevoValor) => setActivo(!nuevoValor),
  });
  const cambiar = (nuevoValor: boolean) => {
    setActivo(nuevoValor);
    mutacion.mutate(nuevoValor);
  };
  return {
    activo,
    cambiar,
    guardando: mutacion.isPending,
    mensajeError: mensajeDeErrorDeEdicion(mutacion.error, accion),
  };
}
