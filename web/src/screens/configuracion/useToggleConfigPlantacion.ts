import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useInvalidarConListado } from '../../hooks/useInvalidarConListado';
import { mensajeErrorConocido } from '../../lib/mensajeErrorConocido';
import { CLAVE_QUERY } from '../../queries/clavesQuery';

interface ToggleConfigPlantacion {
  plantacionId: string;
  valorInicial: boolean;
  guardar: (plantacionId: string, valor: boolean) => Promise<void>;
  /** Mensaje que el repositorio lanza cuando falta la migración de la columna. */
  mensajeSinMigracion: string;
  /** Acción en infinitivo para el mensaje de cualquier otro error: "actualizar la visibilidad". */
  accion: string;
}

/** Toggle booleano de la plantación que guarda al cambiar, sin botón aparte: responde al instante y, si el update falla, vuelve al valor anterior. */
export function useToggleConfigPlantacion({
  plantacionId,
  valorInicial,
  guardar,
  mensajeSinMigracion,
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
    mensajeError: mensajeErrorConocido(mutacion.error, mensajeSinMigracion, accion),
  };
}
