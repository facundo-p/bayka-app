/*
 * A qué zoom encuadrar los puntos en el mapa de la web para que se vea imagen
 * satelital: Esri devuelve tiles grises donde no tiene imagen (#827).
 */
import type { LatLng } from '../../../../shared/distancia';
import { CAPA_SATELITE } from '../capaSatelite';
import { fuenteSatelite, type FuenteTiles } from './fuenteTiles';
import type { AreaMundo, Pixel } from './tiles';
import { zoomConImagen } from './zoomConImagen';

/** Zoom con imagen en todas las zonas de las plantaciones: tope si no se pudo chequear. */
const ZOOM_CON_IMAGEN_SEGURA = 17;
/** Más que esto esperando el tilemap y se encuadra con el tope. */
const ESPERA_DISPONIBILIDAD_MS = 3000;

export type Extremos = { sur: number; oeste: number; norte: number; este: number };

/** Caja en px del mundo a un zoom dado. */
export type CajaPx = { min: Pixel; max: Pixel };

/** En una pasada y sin spread: con miles de puntos `Math.min(...)` revienta la pila. */
export function extremosDe(puntos: readonly LatLng[]): Extremos {
  return puntos.reduce<Extremos>(
    (e, { lat, lng }) => ({
      sur: Math.min(e.sur, lat),
      oeste: Math.min(e.oeste, lng),
      norte: Math.max(e.norte, lat),
      este: Math.max(e.este, lng),
    }),
    { sur: Infinity, oeste: Infinity, norte: -Infinity, este: -Infinity },
  );
}

/** Uno o varios puntos en la misma coordenada: no hay área que encuadrar. */
export const esPuntoUnico = ({ sur, oeste, norte, este }: Extremos) =>
  sur === norte && oeste === este;

/**
 * El zoom en que entran los puntos; un punto único arranca en el seguro en vez
 * del máximo. Null si Leaflet no pudo calcularlo (contenedor más chico que el margen).
 */
export function zoomDePartida(zoomQueEntra: number, puntoUnico: boolean): number | null {
  if (Number.isNaN(zoomQueEntra)) return null;
  const zoom = puntoUnico ? Math.min(zoomQueEntra, ZOOM_CON_IMAGEN_SEGURA) : zoomQueEntra;
  return Math.min(zoom, CAPA_SATELITE.zoomMaximo);
}

export const zoomSinChequeo = (desde: number) => Math.min(desde, ZOOM_CON_IMAGEN_SEGURA);

/** La caja de los puntos con `margen` px de aire de cada lado. */
export function areaConMargen({ min, max }: CajaPx, zoom: number, margen: number): AreaMundo {
  return {
    zoom,
    origen: { x: min.x - margen, y: min.y - margen },
    ancho: max.x - min.x + 2 * margen,
    alto: max.y - min.y + 2 * margen,
  };
}

function vencerEn<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolver, rechazar) => {
    const timer = setTimeout(() => rechazar(new Error('Esri no respondió a tiempo')), ms);
    promesa.then(resolver, rechazar).finally(() => clearTimeout(timer));
  });
}

type OpcionesChequeo = { fuente?: FuenteTiles; esperaMs?: number };

/** El zoom más cercano a `desde` con imagen en toda el área; el seguro si no se pudo saber. */
export async function zoomDeEncuadre(
  area: AreaMundo,
  desde: number,
  { fuente = fuenteSatelite, esperaMs = ESPERA_DISPONIBILIDAD_MS }: OpcionesChequeo = {},
): Promise<number> {
  try {
    const zoom = await vencerEn(zoomConImagen(area, desde, fuente), esperaMs);
    return zoom ?? zoomSinChequeo(desde);
  } catch {
    return zoomSinChequeo(desde);
  }
}
