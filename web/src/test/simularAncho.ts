import { BP } from '../hooks/useMediaQuery';

/**
 * Hace que `useMediaQuery` responda como si la ventana midiera `ancho`.
 * El stub por defecto de `setupTests` no matchea nada (caso desktop); esto es
 * para los tests que verifican qué se renderiza en pantalla chica.
 *
 * Solo entiende las consultas `(max-width: N)` de `BP`, que son las únicas que
 * usa la app.
 */
export function simularAncho(ancho: number): void {
  window.matchMedia = ((consulta: string) => {
    const tope = /\(max-width:\s*(\d+)px\)/.exec(consulta);
    return {
      matches: tope ? ancho <= Number(tope[1]) : false,
      media: consulta,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  }) as unknown as typeof window.matchMedia;
}

/** Anchos con nombre, para que los tests no repitan números sueltos. */
export const ANCHO = {
  desktop: 1920,
  notebook: 1366,
  tablet: 820,
  movil: 430,
} as const;

export { BP };
