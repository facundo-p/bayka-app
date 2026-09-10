import { useCallback, useSyncExternalStore } from 'react';
import { ANCHO_BP } from '../theme/breakpoints';

export type Breakpoint = `(max-width: ${number}px)`;

const consultaAncho = (px: number): Breakpoint => `(max-width: ${px}px)`;

/**
 * Escalones de la escala de breakpoints, como consultas listas para usar.
 *
 * Esto es para lo que el CSS no puede resolver solo: decidir QUÉ se renderiza
 * (columnas de una tabla, un menú plegado). El layout va en `@media`, que no
 * necesita JavaScript ni parpadea en el primer render.
 */
export const BP = Object.freeze(
  Object.fromEntries(
    Object.entries(ANCHO_BP).map(([nombre, px]) => [nombre, consultaAncho(px)]),
  ) as Record<keyof typeof ANCHO_BP, Breakpoint>,
);

/**
 * En SSR y en tests sin stub no hay `matchMedia`: se asume desktop.
 * Se consulta en cada llamada, no una vez al importar el módulo: cacheado en
 * una constante, el guard no protege a quien reemplace `window.matchMedia`
 * después de la carga —que es exactamente lo que hacen los tests.
 */
const hayMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/** `true` mientras la consulta se cumple. Se re-renderiza al cruzar el umbral. */
export function useMediaQuery(consulta: Breakpoint): boolean {
  const suscribir = useCallback(
    (avisar: () => void) => {
      if (!hayMatchMedia()) return () => {};
      const lista = window.matchMedia(consulta);
      lista.addEventListener('change', avisar);
      return () => lista.removeEventListener('change', avisar);
    },
    [consulta],
  );

  const leer = useCallback(
    () => (hayMatchMedia() ? window.matchMedia(consulta).matches : false),
    [consulta],
  );

  // El snapshot del servidor es el mismo que el de un entorno sin matchMedia.
  return useSyncExternalStore(suscribir, leer, () => false);
}
