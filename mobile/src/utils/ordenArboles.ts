import { ORDEN_ARBOLES, type OrdenArboles } from '../constants/ordenArboles';

export const esDescendente = (orden: OrdenArboles) => orden === ORDEN_ARBOLES.descendente;

export const alternarOrden = (orden: OrdenArboles): OrdenArboles =>
  esDescendente(orden) ? ORDEN_ARBOLES.ascendente : ORDEN_ARBOLES.descendente;

/** Los árboles llegan ascendentes por posición; en descendente devuelve una copia invertida. */
export function ordenarArbolesParaVista<T>(arboles: readonly T[], orden: OrdenArboles): T[] {
  const copia = [...arboles];
  return esDescendente(orden) ? copia.reverse() : copia;
}
