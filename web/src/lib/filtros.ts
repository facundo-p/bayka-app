/**
 * Clave del orden en los filtros de un listado. Viaja con ellos porque cambia
 * las filas visibles, pero no descarta ninguna: no cuenta como filtro puesto y
 * «Limpiar» no lo toca (#844).
 */
export const CLAVE_ORDEN = 'orden';

function clavesDeFiltro<F extends object>(iniciales: F): (keyof F)[] {
  return (Object.keys(iniciales) as (keyof F)[]).filter((clave) => clave !== CLAVE_ORDEN);
}

/**
 * Cuántos filtros están puestos, comparando contra sus valores iniciales.
 * Recorre las claves de `iniciales`, que son las que definen el conjunto: lo
 * que no esté ahí no cuenta como filtro.
 */
export function contarFiltrosActivos<F extends object>(actuales: F, iniciales: F): number {
  return clavesDeFiltro(iniciales).filter((clave) => actuales[clave] !== iniciales[clave]).length;
}

/** Los filtros a su valor inicial, con el orden que el usuario haya elegido. */
export function limpiarFiltros<F extends object>(actuales: F, iniciales: F): F {
  if (!(CLAVE_ORDEN in actuales)) return iniciales;
  const orden = CLAVE_ORDEN as keyof F;
  return { ...iniciales, [orden]: actuales[orden] };
}
