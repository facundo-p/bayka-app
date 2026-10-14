/* Selección con checkbox maestro sobre una lista visible: el checklist de especies. */

/** Tri-estado del checkbox maestro según las filas visibles. */
export const ESTADO_MAESTRO = {
  todas: 'todas',
  ninguna: 'ninguna',
  parcial: 'parcial',
} as const;
export type EstadoMaestro = (typeof ESTADO_MAESTRO)[keyof typeof ESTADO_MAESTRO];

/** Acción masiva del maestro sobre las filas visibles. */
export const ACCION_MASIVA = { marcar: 'marcar', desmarcar: 'desmarcar' } as const;
export type AccionMasiva = (typeof ACCION_MASIVA)[keyof typeof ACCION_MASIVA];

export const estanTodas = (estado: EstadoMaestro) => estado === ESTADO_MAESTRO.todas;
export const esParcial = (estado: EstadoMaestro) => estado === ESTADO_MAESTRO.parcial;

/** Las marcadas fuera de `idsVisibles` no cuentan. */
export function estadoMaestro(
  idsVisibles: readonly string[],
  marcadas: ReadonlySet<string>,
): EstadoMaestro {
  const cuantas = idsVisibles.filter((id) => marcadas.has(id)).length;
  if (cuantas === 0) return ESTADO_MAESTRO.ninguna;
  if (cuantas === idsVisibles.length) return ESTADO_MAESTRO.todas;
  return ESTADO_MAESTRO.parcial;
}

/** Con todas marcadas desmarca; con ninguna o algunas marca todo lo visible. */
export function accionDesdeEstado(estado: EstadoMaestro): AccionMasiva {
  return estanTodas(estado) ? ACCION_MASIVA.desmarcar : ACCION_MASIVA.marcar;
}
