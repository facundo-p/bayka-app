import { ORDEN_ARBOLES, type OrdenArboles } from '../constants/ordenArboles';
import { preferenciaOrdenDescendente } from '../services/settings/ordenArbolesStore';
import { alternarOrden, esDescendente } from '../utils/ordenArboles';
import { usePreferenciaBooleana } from './usePreferenciaBooleana';

/** Orden de vista del listado de árboles, recordado entre grupos y reinicios. */
export function useOrdenArboles() {
  const descendente = usePreferenciaBooleana(preferenciaOrdenDescendente);
  const orden: OrdenArboles = descendente ? ORDEN_ARBOLES.descendente : ORDEN_ARBOLES.ascendente;
  const alternar = () => preferenciaOrdenDescendente.set(esDescendente(alternarOrden(orden)));
  return { orden, alternar };
}
