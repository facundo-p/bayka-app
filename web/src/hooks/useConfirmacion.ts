import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

export interface OpcionesConfirmacion {
  accion: () => Promise<void>;
  /** Tras el éxito y antes de cerrar: típicamente, invalidar las queries afectadas. */
  alCompletar?: () => Promise<unknown>;
  /** Con texto de éxito, al terminar muestra el resultado en vez de cerrarse. */
  textoExito?: string;
  onClose: () => void;
}

/** Ejecuta la acción confirmada y, si sale bien, `alCompletar`. */
export function useConfirmacion({ accion, alCompletar, textoExito, onClose }: OpcionesConfirmacion) {
  const [error, setError] = useState<string | null>(null);
  const [completada, setCompletada] = useState(false);
  const mutacion = useMutation({
    mutationFn: accion,
    onSuccess: async () => {
      await alCompletar?.();
      if (textoExito) setCompletada(true);
      else onClose();
    },
    onError: (errorEnvio: Error) => setError(errorEnvio.message),
  });
  return { error, completada, confirmar: () => mutacion.mutate(), confirmando: mutacion.isPending };
}

export type EstadoConfirmacion = ReturnType<typeof useConfirmacion>;
