/**
 * Corre una promesa contra un reloj. Para lo que no acepta `AbortSignal` y por lo
 * tanto no se puede cortar de verdad: `ExpoFile.downloadFileAsync`, el login.
 *
 * La tarea sigue corriendo después del vencimiento —no hay cómo pararla— así que
 * el caller tiene que poder convivir con que termine tarde. Lo que sí se limpia es
 * el reloj: dejarlo vivo mantiene despierto el timer del runtime por cada llamada.
 */
export async function conReloj<T>(
  tarea: PromiseLike<T>,
  ms: number,
  alVencer: () => Error,
): Promise<T> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(tarea),
      new Promise<never>((_, rechazar) => {
        reloj = setTimeout(() => rechazar(alVencer()), ms);
      }),
    ]);
  } finally {
    clearTimeout(reloj);
  }
}
