import type { CSSProperties } from 'react';

/**
 * Arma un `style` con custom properties CSS (`--nombre: valor`) para valores
 * dinámicos por instancia (ancho de barra, color por especie) que no pueden
 * vivir en un CSS module. Solo declara variables, nunca una propiedad CSS
 * final (`width`, `background`...): esa la fija el CSS module con `var(--nombre)`.
 */
export function varsCss(vars: Record<string, string | number>): CSSProperties {
  const propiedades: Record<string, string> = {};
  for (const [nombre, valor] of Object.entries(vars)) {
    propiedades[`--${nombre}`] = String(valor);
  }
  return propiedades as CSSProperties;
}
