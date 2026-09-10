/** Minúsculas y sin acentos: "Lucía" y "lucia" comparan igual. */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Si algún texto contiene la búsqueda, sin distinguir acentos. Vacía coincide con todo. */
export function coincideBusqueda(
  textos: readonly (string | null | undefined)[],
  busqueda: string,
): boolean {
  const termino = normalizarTexto(busqueda.trim());
  return !termino || textos.some((texto) => normalizarTexto(texto ?? '').includes(termino));
}
