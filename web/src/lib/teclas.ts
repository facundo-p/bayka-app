/** Valores de `KeyboardEvent.key` que maneja la app. */
export const TECLA = {
  abajo: 'ArrowDown',
  arriba: 'ArrowUp',
  izquierda: 'ArrowLeft',
  derecha: 'ArrowRight',
  inicio: 'Home',
  fin: 'End',
  enter: 'Enter',
  espacio: ' ',
  escape: 'Escape',
  tab: 'Tab',
} as const;

export type Tecla = (typeof TECLA)[keyof typeof TECLA];

/** Enter o Espacio: las teclas con que se activa un botón. */
export function activaComoBoton(tecla: string): boolean {
  return tecla === TECLA.enter || tecla === TECLA.espacio;
}
