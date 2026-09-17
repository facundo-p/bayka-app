/** Valores de `KeyboardEvent.key` que maneja la app. */
export const TECLA = {
  abajo: 'ArrowDown',
  arriba: 'ArrowUp',
  izquierda: 'ArrowLeft',
  derecha: 'ArrowRight',
  inicio: 'Home',
  fin: 'End',
  enter: 'Enter',
  escape: 'Escape',
  tab: 'Tab',
} as const;

export type Tecla = (typeof TECLA)[keyof typeof TECLA];
