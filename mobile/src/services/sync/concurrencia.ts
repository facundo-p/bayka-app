/**
 * Fotos en vuelo a la vez. Bajo a propósito: `storageUpload` materializa el
 * archivo entero en RAM, así que N en paralelo son N buffers vivos de 2-4 MB. Con
 * 3 la memoria está bien y el tiempo total deja de ser la suma de N round-trips
 * completos (#449). Si en campo resulta peor —red saturada, más reintentos—, se
 * baja a 1 desde acá y nada más.
 */
export const FOTOS_EN_PARALELO = 3;

/**
 * Corre `tarea` sobre cada item con a lo sumo `limite` en vuelo, en el orden de
 * entrada. Ante el primer error deja de tomar items nuevos, espera a que los que
 * ya estaban en vuelo terminen y recién ahí propaga: nada queda corriendo suelto
 * después del throw.
 */
export async function conLimiteDeConcurrencia<T>(
  items: T[],
  limite: number,
  tarea: (item: T) => Promise<void>,
): Promise<void> {
  let siguiente = 0;
  let error: unknown;
  let fallo = false;

  const obrero = async () => {
    while (!fallo) {
      const i = siguiente++;
      if (i >= items.length) return;
      try {
        await tarea(items[i]);
      } catch (e) {
        if (!fallo) {
          fallo = true;
          error = e;
        }
        return;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, obrero));
  if (fallo) throw error;
}
