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

export type Limitador = <R>(tarea: () => Promise<R>) => Promise<R>;

/**
 * Comparte un tope de tareas en vuelo entre llamadas independientes; las que
 * esperan arrancan en orden. Al terminar, el lugar pasa directo a la siguiente:
 * así nadie se cuela entre medio y el tope nunca se pasa.
 */
export function crearLimitador(limite: number): Limitador {
  let enVuelo = 0;
  const esperando: (() => void)[] = [];
  const liberar = () => {
    const siguiente = esperando.shift();
    if (siguiente) siguiente();
    else enVuelo -= 1;
  };
  return async (tarea) => {
    if (enVuelo < limite) enVuelo += 1;
    else await new Promise<void>((arrancar) => esperando.push(arrancar));
    try {
      return await tarea();
    } finally {
      liberar();
    }
  };
}
