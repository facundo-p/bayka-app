import type { MapaDibujado } from './dibujarMapa';

/** Qué muestra la ficha en el lugar del minimapa. */
export const ESTADO_MAPA = {
  listo: 'listo',
  sinGps: 'sin-gps',
  noDisponible: 'no-disponible',
} as const;

/** `conSatelite`: lleva la imagen de Esri y, con ella, la atribución al pie. */
export type MapaPdf =
  | { estado: typeof ESTADO_MAPA.listo; src: string; conSatelite: boolean }
  | { estado: typeof ESTADO_MAPA.sinGps }
  | { estado: typeof ESTADO_MAPA.noDisponible };

export type MapaListo = Extract<MapaPdf, { estado: typeof ESTADO_MAPA.listo }>;

export const MAPA_SIN_GPS: MapaPdf = { estado: ESTADO_MAPA.sinGps };
export const MAPA_NO_DISPONIBLE: MapaPdf = { estado: ESTADO_MAPA.noDisponible };

export function esMapaListo(mapa: MapaPdf): mapa is MapaListo {
  return mapa.estado === ESTADO_MAPA.listo;
}

/** El mapa ya dibujado, con su fondo satelital; no disponible si no se dibujó. */
export function mapaDeDibujo(dibujado: MapaDibujado | null): MapaPdf {
  if (!dibujado) return MAPA_NO_DISPONIBLE;
  return { estado: ESTADO_MAPA.listo, src: dibujado.src, conSatelite: dibujado.conFondo };
}
