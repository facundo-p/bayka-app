import type { CambiosDeEspecies } from '../repositories/CambiosDeEspeciesRepository';

type Seleccion = { especieId: string; enabled: boolean };

/**
 * Lo que cambió respecto de cómo se abrió la pantalla. Una especie que no se muestra
 * (las recuperadas) no está en ninguna de las dos listas: no se toca.
 */
export function cambiosDeLaSeleccion(iniciales: Seleccion[], actuales: Seleccion[]): CambiosDeEspecies {
  const antes = new Map(iniciales.map((i) => [i.especieId, i.enabled]));
  const cambiadas = actuales.filter((i) => antes.has(i.especieId) && antes.get(i.especieId) !== i.enabled);
  return {
    altas: cambiadas.filter((i) => i.enabled).map((i) => i.especieId),
    bajas: cambiadas.filter((i) => !i.enabled).map((i) => i.especieId),
  };
}

/** Especies que se quisieron quitar y siguen porque ya tienen árboles en el servidor (#635). */
export function mensajeEspeciesConArboles(nombres: string[]): string {
  const lista = nombres.join(', ');
  return nombres.length === 1
    ? `${lista} ya tiene árboles registrados en el servidor, así que sigue habilitada.`
    : `${lista} ya tienen árboles registrados en el servidor, así que siguen habilitadas.`;
}

type ResultadoDeSync = { success: boolean; nombre: string; especiesConArboles?: string[] };

/** "Plantación: Especie A, Especie B" por cada plantación del sync con una baja rechazada. */
export function especiesConArbolesDe(resultados: ResultadoDeSync[]): string[] {
  return resultados
    .filter((r) => r.success && (r.especiesConArboles?.length ?? 0) > 0)
    .map((r) => `${r.nombre}: ${r.especiesConArboles!.join(', ')}`);
}
