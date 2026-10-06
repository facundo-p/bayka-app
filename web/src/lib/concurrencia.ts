/**
 * `Promise.all` de `transformar` sobre `items`, pero con a lo sumo `limite` en
 * vuelo a la vez. Conserva el orden de `items`.
 */
export async function mapearConConcurrencia<T, R>(
  items: readonly T[],
  limite: number,
  transformar: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const resultados = new Array<R>(items.length);
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < items.length) {
      const indice = siguiente++;
      resultados[indice] = await transformar(items[indice], indice);
    }
  }
  const trabajadores = Math.max(1, Math.min(limite, items.length));
  await Promise.all(Array.from({ length: trabajadores }, trabajador));
  return resultados;
}
