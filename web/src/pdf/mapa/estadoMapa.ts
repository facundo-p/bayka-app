/** Qué muestra la ficha en el lugar del minimapa. */
export const ESTADO_MAPA = {
  listo: 'listo',
  sinGps: 'sin-gps',
  noDisponible: 'no-disponible',
} as const;

export type MapaPdf =
  | { estado: typeof ESTADO_MAPA.listo; src: string }
  | { estado: typeof ESTADO_MAPA.sinGps }
  | { estado: typeof ESTADO_MAPA.noDisponible };

export const MAPA_SIN_GPS: MapaPdf = { estado: ESTADO_MAPA.sinGps };
export const MAPA_NO_DISPONIBLE: MapaPdf = { estado: ESTADO_MAPA.noDisponible };

export function esMapaListo(mapa: MapaPdf): mapa is Extract<MapaPdf, { src: string }> {
  return mapa.estado === ESTADO_MAPA.listo;
}
