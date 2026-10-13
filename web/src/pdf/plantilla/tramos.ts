/** De a `porTramo` seguidos; el último puede quedar más corto. */
export function enTramos<T>(items: readonly T[], porTramo: number): T[][] {
  const tramos: T[][] = [];
  for (let inicio = 0; inicio < items.length; inicio += porTramo) {
    tramos.push(items.slice(inicio, inicio + porTramo));
  }
  return tramos;
}
