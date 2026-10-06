/*
 * Qué tiles XYZ cubren un encuadre y dónde va cada uno. Usa la misma proyección
 * que los puntos: el satélite queda alineado como en el mapa de la web.
 */
import { CAPA_SATELITE } from '../../lib/capaSatelite';
import { LADO_TILE, type Encuadre, type Pixel } from './proyeccion';

/** Tiles por mapa como máximo: acota la descarga y el tiempo de cada PDF. */
export const TOPE_TILES = { ficha: 16, informe: 36 } as const;

export type TileXYZ = { z: number; x: number; y: number };

/** Un tile y el cuadrado que ocupa en el encuadre, en sus unidades. */
export type TileUbicado = TileXYZ & { destino: Pixel; lado: number };

export type Rango = { primero: number; ultimo: number };

/** Los tiles de un zoom entre dos columnas y dos filas, bordes incluidos. */
export type ZonaTiles = { z: number; x: Rango; y: Rango };

/** Esri guarda los tiles en paquetes de 128 × 128 y su tilemap no cruza de uno a otro. */
const TILES_POR_PAQUETE = 128;

const cantidadDe = ({ primero, ultimo }: Rango) => ultimo - primero + 1;

/** Tiles entre dos px del mundo, sin salirse del mundo. */
function rangoDe(desde: number, hasta: number, ultimoDelMundo: number): Rango {
  return {
    primero: Math.max(0, Math.floor(desde / LADO_TILE)),
    ultimo: Math.min(ultimoDelMundo, Math.ceil(hasta / LADO_TILE) - 1),
  };
}

/** Cuántos px del mundo a `zoom` mide una unidad del encuadre. */
const factorDe = (encuadre: Encuadre, zoom: number) => 2 ** (zoom - encuadre.zoom);

export function zonaDelZoom(encuadre: Encuadre, zoom: number): ZonaTiles {
  const { origen, ancho, alto } = encuadre;
  const factor = factorDe(encuadre, zoom);
  const ultimo = 2 ** zoom - 1;
  return {
    z: zoom,
    x: rangoDe(origen.x * factor, (origen.x + ancho) * factor, ultimo),
    y: rangoDe(origen.y * factor, (origen.y + alto) * factor, ultimo),
  };
}

export function cantidadDeTiles(encuadre: Encuadre, zoom: number): number {
  const { x, y } = zonaDelZoom(encuadre, zoom);
  return cantidadDe(x) * cantidadDe(y);
}

/** El zoom más alto, hasta el máximo de la capa, cuya cobertura entra en `tope` tiles. */
export function elegirZoom(encuadre: Encuadre, tope: number): number {
  let zoom = CAPA_SATELITE.zoomMaximo;
  while (zoom > 0 && cantidadDeTiles(encuadre, zoom) > tope) zoom -= 1;
  return zoom;
}

/** Los tiles de `zoom` que cubren el encuadre, fila por fila. */
export function tilesDelZoom(encuadre: Encuadre, zoom: number): TileUbicado[] {
  const { x, y } = zonaDelZoom(encuadre, zoom);
  const lado = LADO_TILE / factorDe(encuadre, zoom);
  const tiles: TileUbicado[] = [];
  for (let fila = y.primero; fila <= y.ultimo; fila++) {
    for (let columna = x.primero; columna <= x.ultimo; columna++) {
      const destino = {
        x: columna * lado - encuadre.origen.x,
        y: fila * lado - encuadre.origen.y,
      };
      tiles.push({ z: zoom, x: columna, y: fila, destino, lado });
    }
  }
  return tiles;
}

/** `{z}/{y}/{x}` de la plantilla de la capa, con los números del tile. */
export function urlDeTile({ z, x, y }: TileXYZ): string {
  return CAPA_SATELITE.url
    .replace('{z}', String(z))
    .replace('{y}', String(y))
    .replace('{x}', String(x));
}

/** El rango cortado donde empieza un paquete nuevo. */
function partirRango({ primero, ultimo }: Rango): Rango[] {
  const corte = (Math.floor(primero / TILES_POR_PAQUETE) + 1) * TILES_POR_PAQUETE;
  if (corte > ultimo) return [{ primero, ultimo }];
  return [{ primero, ultimo: corte - 1 }, ...partirRango({ primero: corte, ultimo })];
}

/** La zona en pedazos que no cruzan de un paquete de Esri a otro. */
export function partirEnPaquetes({ z, x, y }: ZonaTiles): ZonaTiles[] {
  return partirRango(y).flatMap((filas) =>
    partirRango(x).map((columnas) => ({ z, x: columnas, y: filas })),
  );
}

/** El tilemap de la zona: un 1 o un 0 por tile, fila por fila. */
export function urlDisponibilidad({ z, x, y }: ZonaTiles): string {
  return CAPA_SATELITE.urlDisponibilidad
    .replace('{z}', String(z))
    .replace('{y}', String(y.primero))
    .replace('{x}', String(x.primero))
    .replace('{ancho}', String(cantidadDe(x)))
    .replace('{alto}', String(cantidadDe(y)));
}
