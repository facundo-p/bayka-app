import { medidorRegistrado, type LetraDeRenglon } from './fuentes';
import type { Medidor } from './medirTexto';

/** Un medidor por cada letra de un documento. */
export type MedidoresDe<Letras> = Record<keyof Letras, Medidor>;

/**
 * Un medidor por cada letra, con las fuentes registradas. Va adentro del turno
 * de `renderizarEnSerie`: el documento reusa las fuentes que se leyeron acá.
 */
export async function leerMedidores<Letra extends string>(
  letras: Record<Letra, LetraDeRenglon>,
): Promise<MedidoresDe<typeof letras>> {
  const claves = Object.keys(letras) as Letra[];
  const medidores = await Promise.all(claves.map((clave) => medidorRegistrado(letras[clave])));
  return Object.fromEntries(
    claves.map((clave, indice) => [clave, medidores[indice]]),
  ) as MedidoresDe<typeof letras>;
}
