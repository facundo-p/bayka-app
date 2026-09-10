import { useEffect, type RefObject } from 'react';

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
  useEffect(() => {
    if (!abierto) return;
    function estaAdentro(nodo: Node): boolean {
      return [ref, refExtra].some((candidato) => candidato?.current?.contains(nodo));
    }
    function alClickear(evento: MouseEvent) {
      if (ref.current && !estaAdentro(evento.target as Node)) cerrar();
    }
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === 'Escape') cerrar();
    }
    document.addEventListener('mousedown', alClickear);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alClickear);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto, cerrar, ref, refExtra]);
}
