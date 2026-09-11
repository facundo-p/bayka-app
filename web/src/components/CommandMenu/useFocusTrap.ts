import { useCallback, type RefObject } from 'react';
import { TECLA } from '../../lib/teclas';

const SELECTOR_FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** El extremo opuesto si el foco está en un borde; si no, `null` y el Tab sigue su curso. */
function destinoDelTab(contenedor: HTMLElement, haciaAtras: boolean): HTMLElement | null {
  const focusables = contenedor.querySelectorAll<HTMLElement>(SELECTOR_FOCUSABLE);
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
