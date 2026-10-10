import { useCallback, type RefObject } from 'react';
import { tabulables } from '../lib/foco';
import { TECLA } from '../lib/teclas';

/** El extremo opuesto si el foco está en un borde; si no, `null` y el Tab sigue su curso. */
function destinoDelTab(contenedor: HTMLElement, haciaAtras: boolean): HTMLElement | null {
  const focusables = tabulables(contenedor);
  if (focusables.length === 0) return null;
  const primero = focusables[0];
  const ultimo = focusables[focusables.length - 1];
  const activo = document.activeElement;
  if (haciaAtras && activo === primero) return ultimo;
  if (!haciaAtras && activo === ultimo) return primero;
  return null;
}

/** Atrapa el Tab dentro del contenedor: ciclo entre el primer y último foco. */
export function useFocusTrap(ref: RefObject<HTMLElement | null>) {
  return useCallback(
    (evento: React.KeyboardEvent) => {
      if (evento.key !== TECLA.tab || !ref.current) return;
      const destino = destinoDelTab(ref.current, evento.shiftKey);
      if (!destino) return;
      evento.preventDefault();
      destino.focus();
    },
    [ref],
  );
}
