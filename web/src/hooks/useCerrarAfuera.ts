import { useEffect, type RefObject } from 'react';

/** Cierra un panel flotante al clickear afuera o con Escape. */
export function useCerrarAfuera(
  abierto: boolean,
  cerrar: () => void,
  ref: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!abierto) return;
    function alClickear(evento: MouseEvent) {
      if (ref.current && !ref.current.contains(evento.target as Node)) cerrar();
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
  }, [abierto, cerrar, ref]);
}
