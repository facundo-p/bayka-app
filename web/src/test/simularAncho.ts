import { BP } from '../hooks/useMediaQuery';

/**
 * Único stub de `matchMedia` de los tests: jsdom no lo implementa y
 * `useMediaQuery` lo consulta. Solo entiende las consultas `(max-width: N)` de
 * `BP`, que son las únicas que usa la app.
 *
 * `setupTests` lo reinstala en desktop después de cada test, así un
 * `simularAncho` o un `matchMedia` borrado no se lleva puestos a los que
 * siguen. El estado es global a la ventana: no sirve con `test.concurrent`.
 */
const oyentes = new Set<() => void>();
let anchoSimulado = Number.POSITIVE_INFINITY;

function coincide(consulta: string): boolean {
  const tope = /\(max-width:\s*(\d+)px\)/.exec(consulta);
  return tope ? anchoSimulado <= Number(tope[1]) : false;
}

function matchMediaSimulado(consulta: string) {
  return {
    matches: coincide(consulta),
    media: consulta,
    onchange: null,
    addEventListener: (_: string, avisar: () => void) => oyentes.add(avisar),
    removeEventListener: (_: string, avisar: () => void) => oyentes.delete(avisar),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  };
}

/**
 * Hace que `useMediaQuery` responda como si la ventana midiera `ancho`. Avisa a
 * los componentes montados, que se re-renderizan como al cruzar un umbral real:
 * con algo montado, llamarlo dentro de `act`.
 */
export function simularAncho(ancho: number): void {
  anchoSimulado = ancho;
  window.matchMedia = matchMediaSimulado as unknown as typeof window.matchMedia;
  oyentes.forEach((avisar) => avisar());
}

/** Vuelve al caso desktop, donde ninguna consulta matchea. */
export function restaurarAncho(): void {
  oyentes.clear();
  anchoSimulado = Number.POSITIVE_INFINITY;
  window.matchMedia = matchMediaSimulado as unknown as typeof window.matchMedia;
}

/** Anchos con nombre, para que los tests no repitan números sueltos. */
export const ANCHO = {
  desktop: 1920,
  notebook: 1366,
  tablet: 820,
  movil: 430,
} as const;

export { BP };
