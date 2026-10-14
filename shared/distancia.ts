/** Distancias sobre la superficie terrestre, en metros. */

/** Radio ecuatorial WGS84, el mismo que usa Web Mercator. */
export const RADIO_TIERRA_M = 6378137;

export const GRADOS_A_RADIANES = Math.PI / 180;

export type LatLng = { lat: number; lng: number };

/** Distancia sobre la esfera (haversine), en metros. */
export function distanciaMetros(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * GRADOS_A_RADIANES;
  const dLng = (b.lng - a.lng) * GRADOS_A_RADIANES;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * GRADOS_A_RADIANES) *
      Math.cos(b.lat * GRADOS_A_RADIANES) *
      Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(h));
}
