/** Altas y bajas de una lista de ids (especies #635, técnicos #636): cada lado toca solo lo suyo. */
export type AltasYBajas = { altas: string[]; bajas: string[] };

export const sinCambios = ({ altas, bajas }: AltasYBajas) => altas.length === 0 && bajas.length === 0;

/**
 * Lo que cambió respecto de cómo se abrió la pantalla. Un item que no estaba al abrirla
 * no está en ninguna de las dos listas: no se toca.
 */
export function altasYBajasDeLaSeleccion<T>(
  iniciales: T[],
  actuales: T[],
  id: (item: T) => string,
  marcado: (item: T) => boolean,
): AltasYBajas {
  const antes = new Map(iniciales.map((i) => [id(i), marcado(i)]));
  const cambiados = actuales.filter((i) => antes.has(id(i)) && antes.get(id(i)) !== marcado(i));
  return {
    altas: cambiados.filter(marcado).map(id),
    bajas: cambiados.filter((i) => !marcado(i)).map(id),
  };
}

/** "Plantación: A, B" por cada resultado del sync que trae nombres para avisar. */
export function nombresPorPlantacion<R extends { success: boolean; nombre: string }>(
  resultados: R[],
  nombres: (r: R) => string[] | undefined,
): string[] {
  return resultados
    .filter((r) => r.success && (nombres(r)?.length ?? 0) > 0)
    .map((r) => `${r.nombre}: ${nombres(r)!.join(', ')}`);
}
