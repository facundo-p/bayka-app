import { coincideBusqueda } from '../../lib/normalizarTexto';

type ConCodigoNombre = { codigo: string; nombre: string };

/** Filas cuyo código o nombre contiene la búsqueda, sin distinguir tildes; vacía deja todas. */
export function filtrarPorCodigoNombre<T extends ConCodigoNombre>(
  filas: T[] | undefined,
  busqueda: string,
): T[] | undefined {
  return filas?.filter((fila) => coincideBusqueda([fila.codigo, fila.nombre], busqueda));
}
