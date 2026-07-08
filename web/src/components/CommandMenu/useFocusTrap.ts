import { useCallback, type RefObject } from 'react';

const SELECTOR_FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Atrapa el Tab dentro del contenedor: ciclo entre el primer y último foco. */
export function useFocusTrap(ref: RefObject<HTMLElement | null>) {
  return useCallback(
    (evento: React.KeyboardEvent) => {
      if (evento.key !== 'Tab' || !ref.current) return;
      const focusables = Array.from(
        ref.current.querySelectorAll<HTMLElement>(SELECTOR_FOCUSABLE),
      );
      if (focusables.length === 0) return;
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      const activo = document.activeElement;
      if (evento.shiftKey && activo === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && activo === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    },
    [ref],
  );
}
