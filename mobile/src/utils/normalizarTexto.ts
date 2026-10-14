/** Sin tildes ni diéresis: "Álamo" y "alamo" se comparan igual. */
export function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const paraBuscar = (texto: string) => sinAcentos(texto).toLocaleLowerCase().trim();

/** Alguno de los textos contiene la búsqueda, sin distinguir mayúsculas ni tildes. Vacía coincide con todo. */
export function coincideBusqueda(textos: readonly (string | null | undefined)[], busqueda: string): boolean {
  const buscada = paraBuscar(busqueda);
  if (buscada === '') return true;
  return textos.some((texto) => texto != null && paraBuscar(texto).includes(buscada));
}
