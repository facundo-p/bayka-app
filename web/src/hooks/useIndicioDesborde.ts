import { useEffect, useState, type RefObject } from 'react';

/** Hacia qué lado queda contenido fuera de la vista de un elemento con scroll horizontal. */
export type Desborde = { izquierda: boolean; derecha: boolean };

const SIN_DESBORDE: Desborde = { izquierda: false, derecha: false };

/** Los redondeos de subpíxel dejan `scrollLeft + clientWidth` a un px del final. */
const TOLERANCIA_PX = 1;

export function medirDesborde(el: HTMLElement): Desborde {
  const { scrollLeft, scrollWidth, clientWidth } = el;
  return {
    izquierda: scrollLeft > TOLERANCIA_PX,
    derecha: scrollLeft + clientWidth < scrollWidth - TOLERANCIA_PX,
  };
}

const mismoDesborde = (a: Desborde, b: Desborde) =>
  a.izquierda === b.izquierda && a.derecha === b.derecha;

/**
 * Sigue el scroll y el resize del elemento (y de su primer hijo, que es el que
 * cambia de ancho al soltar columnas) para saber si hay más contenido hacia
 * un lado. El CSS no puede detectar overflow: por eso vive en un hook (#368).
 */
export function useIndicioDesborde(ref: RefObject<HTMLElement | null>): Desborde {
  const [desborde, setDesborde] = useState(SIN_DESBORDE);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const actualizar = () => {
      const medido = medirDesborde(el);
      setDesborde((previo) => (mismoDesborde(previo, medido) ? previo : medido));
    };
    actualizar();
    el.addEventListener('scroll', actualizar, { passive: true });
    // jsdom no tiene ResizeObserver; sin él queda solo el scroll.
    const observador =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(actualizar);
    observador?.observe(el);
    if (el.firstElementChild) observador?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', actualizar);
      observador?.disconnect();
    };
  }, [ref]);

  return desborde;
}
