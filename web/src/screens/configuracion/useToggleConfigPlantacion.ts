import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useInvalidarConListado } from '../../hooks/useInvalidarConListado';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { mensajeDeErrorDeEdicion, valorDelServidor } from '../../repositories/edicionDePlantacion';

interface ToggleConfigPlantacion {
  plantacionId: string;
  valorInicial: boolean;
  guardar: (plantacionId: string, valor: boolean) => Promise<void>;
  /** Columna de `plantations`: si otro la cambió mientras tanto, el toggle toma ese valor. */
  columna: string;
  /** Acción en infinitivo para el mensaje de cualquier otro error: "actualizar la visibilidad". */
  accion: string;
}

/** Toggle booleano de la plantación que guarda al cambiar, sin botón aparte: responde al instante y, si el guardado falla, vuelve al valor anterior o al que puso otro. */
export function useToggleConfigPlantacion({
  plantacionId,
  valorInicial,
  guardar,
  columna,
  accion,
}: ToggleConfigPlantacion) {
  const [activo, setActivo] = useState(valorInicial);
  const invalidar = useInvalidarConListado(CLAVE_QUERY.plantacion(plantacionId));
  const mutacion = useMutation({
    mutationFn: (nuevoValor: boolean) => guardar(plantacionId, nuevoValor),
    onSuccess: invalidar,
    onError: (error, nuevoValor) => {
      const delServidor = valorDelServidor(error, columna);
      setActivo(typeof delServidor === 'boolean' ? delServidor : !nuevoValor);
      if (delServidor !== undefined) void invalidar();
    },
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
