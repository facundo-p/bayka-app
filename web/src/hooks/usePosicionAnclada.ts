import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import { varsCss } from '../lib/cssVars';

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

function aPx(valor: number | null): string {
  return valor === null ? 'auto' : `${valor}px`;
}

/** La posición como variables CSS: el panel las lee con `var(--arriba)`, `var(--ancho)`, etc. */
export function varsPosicionAnclada(posicion: PosicionAnclada): CSSProperties {
  return varsCss({
    arriba: aPx(posicion.arriba),
    abajo: aPx(posicion.abajo),
    izquierda: aPx(posicion.izquierda),
    ancho: aPx(posicion.ancho),
    'alto-disponible': aPx(posicion.altoMaximo),
  });
}

/** Vuelve a medir si la ventana cambia de tamaño o algo scrollea; devuelve la limpieza. */
function escucharReposicion(medir: () => void): () => void {
  window.addEventListener('resize', medir);
  // En captura: el scroll de un contenedor interno no burbujea hasta window.
  window.addEventListener('scroll', medir, true);
  return () => {
    window.removeEventListener('resize', medir);
    window.removeEventListener('scroll', medir, true);
  };
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
    return escucharReposicion(medir);
  }, [abierto, ref]);
  return abierto ? posicion : null;
}
