import { useEffect } from 'react';
import { TECLA } from '../lib/teclas';

/** Cierra con Escape una superficie abierta (modal, panel lateral, popover). */
export function useCerrarConEscape(abierto: boolean, cerrar: () => void) {
  useEffect(() => {
    if (!abierto) return;
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === TECLA.escape) cerrar();
    }
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto, cerrar]);
}
