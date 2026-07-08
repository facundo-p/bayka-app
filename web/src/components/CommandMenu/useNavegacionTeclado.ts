import { useCallback, useEffect, useRef, useState } from 'react';

/** Navegación por teclado sobre una lista plana ordenada, con wrap y scroll
 *  contenido en el contenedor (sin scrollIntoView global de la página). */
export function useNavegacionTeclado(cantidad: number, alElegir: (indice: number) => void) {
  const [resaltado, setResaltado] = useState(0);
  const refLista = useRef<HTMLDivElement>(null);

  // Al cambiar el set de resultados, volver al primero.
  useEffect(() => setResaltado(0), [cantidad]);

  // Mantener el ítem resaltado visible dentro del contenedor de la lista.
  useEffect(() => {
    const lista = refLista.current;
    const activo = lista?.querySelector<HTMLElement>('[data-resaltado="true"]');
    if (!lista || !activo) return;
    const arriba = activo.offsetTop;
    const abajo = arriba + activo.offsetHeight;
    if (arriba < lista.scrollTop) lista.scrollTop = arriba;
    else if (abajo > lista.scrollTop + lista.clientHeight) {
      lista.scrollTop = abajo - lista.clientHeight;
    }
  }, [resaltado]);

  const alPresionar = useCallback(
    (evento: React.KeyboardEvent) => {
      if (cantidad === 0) return;
      if (evento.key === 'ArrowDown') {
        evento.preventDefault();
        setResaltado((previo) => (previo + 1) % cantidad);
      } else if (evento.key === 'ArrowUp') {
        evento.preventDefault();
        setResaltado((previo) => (previo - 1 + cantidad) % cantidad);
      } else if (evento.key === 'Enter') {
        evento.preventDefault();
        alElegir(resaltado);
      }
    },
    [cantidad, resaltado, alElegir],
  );

  return { resaltado, setResaltado, refLista, alPresionar };
}
