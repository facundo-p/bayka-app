/*
 * Direcciones XYZ de la capa satelital: qué tiles cubren un rectángulo del
 * mundo y las URL de Esri para bajarlos o preguntar si tienen imagen.
 */
import { CAPA_SATELITE } from '../capaSatelite';

/** Lado de un tile XYZ en px. */
export const LADO_TILE = 256;

export type Pixel = { x: number; y: number };

/**
 * Un rectángulo del mundo en px a `zoom`, que puede ser fraccionario. El
 * `Encuadre` del PDF y el encuadre del mapa de la web lo cumplen.
 */
export type AreaMundo = { zoom: number; origen: Pixel; ancho: number; alto: number };

export type TileXYZ = { z: number; x: number; y: number };

export type Rango = { primero: number; ultimo: number };

/** Los tiles de un zoom entre dos columnas y dos filas, bordes incluidos. */
export type ZonaTiles = { z: number; x: Rango; y: Rango };

/** Esri guarda los tiles en paquetes de 128 × 128 y su tilemap no cruza de uno a otro. */
const TILES_POR_PAQUETE = 128;

export const cantidadDe = ({ primero, ultimo }: Rango) => ultimo - primero + 1;

/** Tiles entre dos px del mundo, sin salirse del mundo. */
function rangoDe(desde: number, hasta: number, ultimoDelMundo: number): Rango {
  return {
    primero: Math.max(0, Math.floor(desde / LADO_TILE)),
    ultimo: Math.min(ultimoDelMundo, Math.ceil(hasta / LADO_TILE) - 1),
  };
}

/** Cuántos px del mundo a `zoom` mide un px del área. */
export const factorDe = (area: AreaMundo, zoom: number) => 2 ** (zoom - area.zoom);

export function zonaDelZoom(area: AreaMundo, zoom: number): ZonaTiles {
  const { origen, ancho, alto } = area;
  const factor = factorDe(area, zoom);
  const ultimo = 2 ** zoom - 1;
  return {
    z: zoom,
    x: rangoDe(origen.x * factor, (origen.x + ancho) * factor, ultimo),
    y: rangoDe(origen.y * factor, (origen.y + alto) * factor, ultimo),
  };
}

/** La plantilla con cada `{clave}` reemplazada por su valor; una clave sin valor es un error. */
function rellenar(plantilla: string, valores: Record<string, number>): string {
  return plantilla.replace(/\{(\w+)\}/g, (_, clave: string) => {
    if (!(clave in valores)) throw new Error(`Falta {${clave}} para ${plantilla}`);
    return String(valores[clave]);
  });
}

/** `{z}/{y}/{x}` de la plantilla de la capa, con los números del tile. */
export function urlDeTile({ z, x, y }: TileXYZ): string {
  return rellenar(CAPA_SATELITE.url, { z, x, y });
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
  const ancho = cantidadDe(x);
  const alto = cantidadDe(y);
  return rellenar(CAPA_SATELITE.urlDisponibilidad, { z, x: x.primero, y: y.primero, ancho, alto });
}
