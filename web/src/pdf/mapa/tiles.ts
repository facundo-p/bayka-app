/*
 * Qué tiles XYZ cubren un encuadre y dónde va cada uno. Usa la misma proyección
 * que los puntos: el satélite queda alineado como en el mapa de la web.
 */
import { CAPA_SATELITE } from '../../lib/capaSatelite';
import { cantidadDe, factorDe, LADO_TILE, type TileXYZ, zonaDelZoom } from '../../lib/mapa/tiles';
import type { Encuadre, Pixel } from './proyeccion';

/** Tiles por mapa como máximo: acota la descarga y el tiempo de cada PDF. */
export const TOPE_TILES = { ficha: 16, informe: 36 } as const;

/** Un tile y el cuadrado que ocupa en el encuadre, en sus unidades. */
export type TileUbicado = TileXYZ & { destino: Pixel; lado: number };

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
