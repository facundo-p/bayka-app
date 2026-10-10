/**
 * Claves que pueden viajar con los filtros de un listado pero que la barra deja
 * a la vista, fuera del panel: el buscador y el orden. No cuentan en el botón
 * «Filtros» y «Limpiar» no las toca (#844).
 */
export const CLAVE_A_LA_VISTA = {
  busqueda: 'busqueda',
  orden: 'orden',
} as const;

const CLAVES_A_LA_VISTA: readonly string[] = Object.values(CLAVE_A_LA_VISTA);

function esFiltroDelPanel(clave: PropertyKey): boolean {
  return !CLAVES_A_LA_VISTA.includes(String(clave));
}

function clavesDeFiltro<F extends object>(iniciales: F): (keyof F)[] {
  return (Object.keys(iniciales) as (keyof F)[]).filter(esFiltroDelPanel);
}

/**
 * Cuántos filtros están puestos, comparando contra sus valores iniciales.
 * Recorre las claves de `iniciales`, que son las que definen el conjunto: lo
 * que no esté ahí no cuenta como filtro.
 */
export function contarFiltrosActivos<F extends object>(actuales: F, iniciales: F): number {
  return clavesDeFiltro(iniciales).filter((clave) => actuales[clave] !== iniciales[clave]).length;
}

/** Los filtros a su valor inicial, con la búsqueda y el orden como estaban. */
export function limpiarFiltros<F extends object>(actuales: F, iniciales: F): F {
  const limpios = { ...actuales };
  for (const clave of clavesDeFiltro(iniciales)) limpios[clave] = iniciales[clave];
  return limpios;
}
