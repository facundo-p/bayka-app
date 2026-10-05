import { useMemo } from 'react';

import { preferenciaEstiloBotonera } from '../services/settings/estiloBotoneraStore';
import { usePreferencia } from './usePreferencia';

/** Tamaño y orden de la botonera del usuario: cambiarlo en Opciones se ve al instante en la grilla. */
export function useEstiloBotonera(userId: string) {
  const preferencia = useMemo(() => preferenciaEstiloBotonera(userId), [userId]);
  const estilo = usePreferencia(preferencia);
  return { estilo, setEstilo: preferencia.set };
}
