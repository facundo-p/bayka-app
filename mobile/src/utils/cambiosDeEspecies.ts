import { altasYBajasDeLaSeleccion, nombresPorPlantacion, type AltasYBajas } from './altasYBajas';

type Seleccion = { especieId: string; enabled: boolean };

/** Una especie que no se muestra (las recuperadas) no está en ninguna de las dos listas: no se toca. */
export function cambiosDeLaSeleccion(iniciales: Seleccion[], actuales: Seleccion[]): AltasYBajas {
  return altasYBajasDeLaSeleccion(iniciales, actuales, (i) => i.especieId, (i) => i.enabled);
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
  return nombresPorPlantacion(resultados, (r) => r.especiesConArboles);
}
