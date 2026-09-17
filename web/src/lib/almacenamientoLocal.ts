/** Claves de localStorage. Cambiar una pierde lo que cada navegador ya guardó. */
export const CLAVE_STORAGE = {
  novedadesUltimaVista: 'bayka.novedades.ultima-vista',
  recientesCommandMenu: 'bayka.command-menu.recientes',
} as const;

export type ClaveStorage = (typeof CLAVE_STORAGE)[keyof typeof CLAVE_STORAGE];

/** `null` si no hay valor o si el storage está bloqueado (modo privado, política del navegador). */
export function leerLocal(clave: ClaveStorage): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

/** Si no se puede persistir no pasa nada: quien llama sigue con el valor en memoria. */
export function guardarLocal(clave: ClaveStorage, valor: string): void {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    // Storage lleno o bloqueado.
  }
}
