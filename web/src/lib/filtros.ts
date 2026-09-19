/**
 * Cuántos filtros están puestos, comparando contra sus valores iniciales.
 * Recorre las claves de `iniciales`, que son las que definen el conjunto: lo
 * que no esté ahí no cuenta como filtro.
 */
export function contarFiltrosActivos<F extends object>(actuales: F, iniciales: F): number {
  const claves = Object.keys(iniciales) as (keyof F)[];
  return claves.filter((clave) => actuales[clave] !== iniciales[clave]).length;
}
