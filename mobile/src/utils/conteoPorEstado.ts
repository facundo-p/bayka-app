import { ESTADO_PLANTACION, esActiva, esFinalizada, type EstadoPlantacion } from '../constants/estados';

export type ConteoPorEstado = Record<EstadoPlantacion, number>;

/** Sirve para plantaciones y grupos: otros estados (p. ej. 'sincronizada') no suman. */
export function contarPorEstado(
  items: readonly { estado?: string | null }[] | null | undefined,
): ConteoPorEstado {
  const conteo: ConteoPorEstado = { [ESTADO_PLANTACION.activa]: 0, [ESTADO_PLANTACION.finalizada]: 0 };
  for (const item of items ?? []) {
    if (esActiva(item)) conteo[ESTADO_PLANTACION.activa]++;
    else if (esFinalizada(item)) conteo[ESTADO_PLANTACION.finalizada]++;
  }
  return conteo;
}
