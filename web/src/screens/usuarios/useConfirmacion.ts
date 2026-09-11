import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useInvalidarUsuarios } from '../../hooks/useInvalidarUsuarios';

export interface OpcionesConfirmacion {
  accion: () => Promise<void>;
  /** Con texto de éxito, al terminar muestra el resultado en vez de cerrarse. */
  textoExito?: string;
  onClose: () => void;
}

/** Ejecuta la acción confirmada y refresca el listado. */
export function useConfirmacion({ accion, textoExito, onClose }: OpcionesConfirmacion) {
  const invalidarUsuarios = useInvalidarUsuarios();
  const [error, setError] = useState<string | null>(null);
  const [completada, setCompletada] = useState(false);
  const mutacion = useMutation({
    mutationFn: accion,
    onSuccess: async () => {
      await invalidarUsuarios();
      if (textoExito) setCompletada(true);
      else onClose();
    },
    onError: (errorEnvio: Error) => setError(errorEnvio.message),
  });
  return { error, completada, confirmar: () => mutacion.mutate(), confirmando: mutacion.isPending };
}

export type EstadoConfirmacion = ReturnType<typeof useConfirmacion>;
