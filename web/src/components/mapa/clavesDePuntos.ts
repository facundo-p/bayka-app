import type { PuntoGps } from './types';

/**
 * Key estable por árbol para los markers del mapa. El ID Árbol no tiene
 * restricción de unicidad en la base: si se repite, las copias llevan sufijo.
 */
export function clavesDePuntos(puntos: PuntoGps[]): string[] {
  const vistas = new Map<string, number>();
  return puntos.map(({ idArbol }) => {
    const repeticiones = vistas.get(idArbol) ?? 0;
    vistas.set(idArbol, repeticiones + 1);
    return repeticiones === 0 ? idArbol : `${idArbol}#${repeticiones}`;
  });
}
