/**
 * Lo que alcanza el Tab: sin los deshabilitados ni los `tabindex="-1"`, como
 * las opciones no elegidas de un segmentado, que se recorren con las flechas.
 */
const SELECTOR_TABULABLE = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]',
]
  .map((selector) => `${selector}:not([tabindex="-1"])`)
  .join(', ');

/** Los elementos del contenedor que alcanza el Tab, en orden de documento. */
export function tabulables(contenedor: HTMLElement): HTMLElement[] {
  return [...contenedor.querySelectorAll<HTMLElement>(SELECTOR_TABULABLE)];
}

/** El foco quedó en ningún lado: su elemento se desmontó o se clickeó un área inerte. */
export function focoPerdido(): boolean {
  return document.activeElement === null || document.activeElement === document.body;
}
