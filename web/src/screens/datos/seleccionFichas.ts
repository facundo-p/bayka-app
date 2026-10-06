import { formatearEntero, pluralizar } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';

/** Recuento de la barra del modo selección (#755). */
export function textoSeleccion(cantidad: number, totalPagina: number): string {
  if (cantidad > 1 && cantidad === totalPagina) {
    return `Los ${formatearEntero(cantidad)} árboles de esta página`;
  }
  const seleccionados = cantidad === 1 ? 'seleccionado' : 'seleccionados';
  return `${pluralizar(cantidad, SUSTANTIVO.arbol)} ${seleccionados}`;
}

export function textoGenerarFichas(cantidad: number): string {
  return `Generar fichas (${formatearEntero(cantidad)})`;
}
