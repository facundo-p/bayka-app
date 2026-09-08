import '@testing-library/jest-dom/vitest';

/**
 * jsdom no implementa `matchMedia` y `useMediaQuery` lo consulta. Sin stub, todo
 * componente que decida qué renderizar por ancho explota al montarse.
 *
 * Por defecto ninguna consulta matchea, que es el caso desktop: los tests que
 * necesitan pantalla chica lo sobrescriben con `simularAncho()`.
 */
window.matchMedia = ((consulta: string) => ({
  matches: false,
  media: consulta,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;
