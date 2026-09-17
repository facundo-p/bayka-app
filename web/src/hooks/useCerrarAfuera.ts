import { useEffect, type RefObject } from 'react';
import { useCerrarConEscape } from './useCerrarConEscape';

/**
 * Cierra un panel flotante al clickear afuera o con Escape. `refExtra` también
 * cuenta como adentro: un popover en portal no es descendiente del disparador.
 */
export function useCerrarAfuera(
  abierto: boolean,
  cerrar: () => void,
  ref: RefObject<HTMLElement | null>,
  refExtra?: RefObject<HTMLElement | null>,
) {
  useCerrarConEscape(abierto, cerrar);
  useEffect(() => {
    if (!abierto) return;
    function alClickear(evento: MouseEvent) {
      const nodo = evento.target as Node;
      const adentro = [ref, refExtra].some((candidato) => candidato?.current?.contains(nodo));
      if (ref.current && !adentro) cerrar();
    }
    document.addEventListener('mousedown', alClickear);
    return () => document.removeEventListener('mousedown', alClickear);
  }, [abierto, cerrar, ref, refExtra]);
}
