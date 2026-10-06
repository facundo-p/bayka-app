/*
 * Web Mercator (EPSG:3857), la proyección de los tiles XYZ de Esri y OSM: un mapa
 * encuadrado acá se alinea con los tiles del mismo zoom sin otra conversión.
 */

/** Lado de un tile XYZ en px. */
export const LADO_TILE = 256;

const RADIO_TIERRA_M = 6378137;
/** Latitud donde Web Mercator corta el mundo en un cuadrado. */
const LATITUD_MAXIMA = 85.05112878;
const GRADOS_A_RADIANES = Math.PI / 180;

export type LatLng = { lat: number; lng: number };
export type Pixel = { x: number; y: number };

/**
 * Lo que se ve del mundo en un rectángulo de `ancho` × `alto`. El zoom es
 * fraccionario: para tiles se baja el entero de arriba y se escala.
 */
export type Encuadre = {
  zoom: number;
  /** Pixel del mundo, a ese zoom, de la esquina superior izquierda. */
  origen: Pixel;
  ancho: number;
  alto: number;
  /** Latitud del centro: de ella depende cuántos metros mide un px. */
  latitudCentro: number;
};

export type OpcionesEncuadre = {
  /** Aire mínimo entre los puntos y el borde, en las unidades de `ancho`. */
  margen: number;
  /** Lado mínimo de lo encuadrado, para un punto solo o puntos casi coincidentes. */
  minimoMetros: number;
};

function acotarLatitud(lat: number): number {
  return Math.max(-LATITUD_MAXIMA, Math.min(LATITUD_MAXIMA, lat));
}

/** Pixel del mundo de un punto a un zoom dado; a zoom 0 el mundo mide un tile. */
export function pixelDelMundo({ lat, lng }: LatLng, zoom: number): Pixel {
  const lado = LADO_TILE * 2 ** zoom;
  const seno = Math.sin(acotarLatitud(lat) * GRADOS_A_RADIANES);
  return {
    x: ((lng + 180) / 360) * lado,
    y: (0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) * lado,
  };
}

/** Metros que cubre un px a esa latitud y zoom. */
export function metrosPorPixel(lat: number, zoom: number): number {
  const circunferencia = 2 * Math.PI * RADIO_TIERRA_M;
  return (
    (circunferencia * Math.cos(acotarLatitud(lat) * GRADOS_A_RADIANES)) / (LADO_TILE * 2 ** zoom)
  );
}

type Caja = { min: Pixel; max: Pixel };

/** En una pasada y sin spread: `Math.min(...xs)` revienta la pila con decenas de miles de puntos. */
function cajaDe(pixeles: readonly Pixel[]): Caja {
  return pixeles.reduce<Caja>(
    (caja, { x, y }) => ({
      min: { x: Math.min(caja.min.x, x), y: Math.min(caja.min.y, y) },
      max: { x: Math.max(caja.max.x, x), y: Math.max(caja.max.y, y) },
    }),
    { min: { x: Infinity, y: Infinity }, max: { x: -Infinity, y: -Infinity } },
  );
}

function latitudCentral(puntos: readonly LatLng[]): number {
  const { min, max } = cajaDe(puntos.map((punto) => ({ x: 0, y: punto.lat })));
  return (min.y + max.y) / 2;
}

/** Origen que deja el centro de la caja en el centro del rectángulo. */
function origenCentrado(caja: Caja, zoom: number, ancho: number, alto: number): Pixel {
  const escala = 2 ** zoom;
  const centro = { x: (caja.min.x + caja.max.x) / 2, y: (caja.min.y + caja.max.y) / 2 };
  return { x: centro.x * escala - ancho / 2, y: centro.y * escala - alto / 2 };
}

type Extension = { caja: Caja; latitudCentro: number; x: number; y: number };

/** Ancho y alto de lo que ocupan los puntos, en px del mundo a zoom 0, con el lado mínimo. */
function extensionDe(puntos: readonly LatLng[], minimoMetros: number): Extension {
  const caja = cajaDe(puntos.map((punto) => pixelDelMundo(punto, 0)));
  const latitudCentro = latitudCentral(puntos);
  const minimo = minimoMetros / metrosPorPixel(latitudCentro, 0);
  return {
    caja,
    latitudCentro,
    x: Math.max(caja.max.x - caja.min.x, minimo),
    y: Math.max(caja.max.y - caja.min.y, minimo),
  };
}

/** Ancho sobre alto de lo que ocupan los puntos en el mapa; 1 sin puntos. */
export function aspectoDe(puntos: readonly LatLng[], minimoMetros: number): number {
  if (puntos.length === 0) return 1;
  const extension = extensionDe(puntos, minimoMetros);
  return extension.x / extension.y;
}

/** El zoom más alto que deja entrar todos los puntos con el margen pedido. */
export function encuadrar(
  puntos: readonly LatLng[],
  ancho: number,
  alto: number,
  { margen, minimoMetros }: OpcionesEncuadre,
): Encuadre {
  if (puntos.length === 0) throw new Error('No hay puntos que encuadrar');
  const { caja, latitudCentro, ...extension } = extensionDe(puntos, minimoMetros);
  const zoom = Math.log2(
    Math.min((ancho - 2 * margen) / extension.x, (alto - 2 * margen) / extension.y),
  );
  const origen = origenCentrado(caja, zoom, ancho, alto);
  return { zoom, origen, ancho, alto, latitudCentro };
}

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

/** Posición de un punto dentro del encuadre, en sus unidades. */
export function proyectar(encuadre: Encuadre, punto: LatLng): Pixel {
  const mundo = pixelDelMundo(punto, encuadre.zoom);
  return { x: mundo.x - encuadre.origen.x, y: mundo.y - encuadre.origen.y };
}
