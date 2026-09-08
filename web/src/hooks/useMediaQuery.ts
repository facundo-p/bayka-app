import { useCallback, useSyncExternalStore } from 'react';

/**
 * Escalones de la escala de breakpoints, como consultas listas para usar.
 * Los números son los mismos que documenta el bloque Layout de `theme.css`;
 * ahí están las razones de cada uno.
 *
 * Esto es para lo que el CSS no puede resolver solo: decidir QUÉ se renderiza
 * (columnas de una tabla, un menú plegado). El layout va en `@media`, que no
 * necesita JavaScript ni parpadea en el primer render.
 */
export const BP = {
  notebook: '(max-width: 1400px)',
  compacta: '(max-width: 1200px)',
  tablet: '(max-width: 900px)',
  movil: '(max-width: 600px)',
} as const;

export type Breakpoint = (typeof BP)[keyof typeof BP];

/** En SSR y en tests sin stub no hay `matchMedia`: se asume desktop. */
const SIN_MATCH_MEDIA = typeof window === 'undefined' || !window.matchMedia;

/** `true` mientras la consulta se cumple. Se re-renderiza al cruzar el umbral. */
export function useMediaQuery(consulta: Breakpoint | string): boolean {
  const suscribir = useCallback(
    (avisar: () => void) => {
      if (SIN_MATCH_MEDIA) return () => {};
      const lista = window.matchMedia(consulta);
      lista.addEventListener('change', avisar);
      return () => lista.removeEventListener('change', avisar);
    },
    [consulta],
  );

  const leer = useCallback(
    () => (SIN_MATCH_MEDIA ? false : window.matchMedia(consulta).matches),
    [consulta],
  );

  // El snapshot del servidor es el mismo que el de un entorno sin matchMedia.
  return useSyncExternalStore(suscribir, leer, () => false);
}
