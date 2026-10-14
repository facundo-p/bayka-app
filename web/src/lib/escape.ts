import { TECLA } from './teclas';

/** Lo que usa de un evento de teclado, sea de React o del DOM. */
type EventoTecla = Pick<KeyboardEvent, 'key' | 'stopPropagation'>;

/**
 * Escape cierra solo la capa que lo recibe (modal, paleta, lista, popover):
 * frenado acá no llega al detalle o la pantalla de atrás, que escuchan en
 * `document`. Devuelve si era Escape, para que las otras teclas sigan su curso.
 */
export function cerrarSoloEstaCapa(evento: EventoTecla, cerrar: () => void): boolean {
  if (evento.key !== TECLA.escape) return false;
  evento.stopPropagation();
  cerrar();
  return true;
}
