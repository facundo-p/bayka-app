import { useLayoutEffect, useState, type RefObject } from 'react';

const SEPARACION = 4;
const MARGEN_VIEWPORT = 8;
/** Con menos lugar que esto debajo del ancla, se abre hacia arriba si allá hay más. */
const ALTO_MINIMO_ABAJO = 200;

export type PosicionAnclada = {
  /** px desde el borde superior del viewport; null si se ancla por abajo. */
  arriba: number | null;
  /** px desde el borde inferior del viewport; null si se ancla por arriba. */
  abajo: number | null;
  izquierda: number;
  ancho: number;
  altoMaximo: number;
};

type Ancla = Pick<DOMRect, 'top' | 'bottom' | 'left' | 'width'>;

export function calcularPosicion(ancla: Ancla, altoViewport: number): PosicionAnclada {
  const espacioAbajo = altoViewport - ancla.bottom - SEPARACION - MARGEN_VIEWPORT;
  const espacioArriba = ancla.top - SEPARACION - MARGEN_VIEWPORT;
  const horizontal = { izquierda: ancla.left, ancho: ancla.width };
  if (espacioAbajo < ALTO_MINIMO_ABAJO && espacioArriba > espacioAbajo) {
    const abajo = altoViewport - ancla.top + SEPARACION;
    return { ...horizontal, arriba: null, abajo, altoMaximo: espacioArriba };
  }
  const arriba = ancla.bottom + SEPARACION;
  return { ...horizontal, arriba, abajo: null, altoMaximo: espacioAbajo };
}

/**
 * Posición `fixed` pegada al ancla, para paneles en portal que no deben quedar
 * recortados por el overflow de un contenedor (ej. un modal).
 */
export function usePosicionAnclada(
  abierto: boolean,
  ref: RefObject<HTMLElement | null>,
): PosicionAnclada | null {
  const [posicion, setPosicion] = useState<PosicionAnclada | null>(null);
  useLayoutEffect(() => {
    if (!abierto) return;
    function medir() {
      const ancla = ref.current;
      if (ancla) setPosicion(calcularPosicion(ancla.getBoundingClientRect(), window.innerHeight));
    }
    medir();
    window.addEventListener('resize', medir);
    // En captura: el scroll de un contenedor interno no burbujea hasta window.
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [abierto, ref]);
  return abierto ? posicion : null;
}
