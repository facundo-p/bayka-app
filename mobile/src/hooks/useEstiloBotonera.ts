import type { EstiloBotonera } from '../constants/estiloBotonera';
import { preferenciaEstiloBotonera } from '../services/settings/estiloBotoneraStore';
import { useCurrentUserId } from './useCurrentUserId';
import { usePreferencia } from './usePreferencia';

/** Tamaño y orden de la botonera del usuario: cambiarlo en Opciones se ve al instante en la grilla. */
export function useEstiloBotonera() {
  const preferencia = preferenciaEstiloBotonera(useCurrentUserId());
  const estilo = usePreferencia(preferencia);
  const setEstilo = (nuevo: EstiloBotonera) => {
    // Si no se puede guardar, el cambio vale igual hasta cerrar la app.
    preferencia.set(nuevo).catch((e) => console.warn('[Botonera] no se pudo guardar el estilo:', e));
  };
  return { estilo, setEstilo };
}
