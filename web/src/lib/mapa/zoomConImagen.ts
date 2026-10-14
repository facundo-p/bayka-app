import type { FuenteTiles } from './fuenteTiles';
import { zonaDelZoom, type AreaMundo } from './tiles';

/**
 * Zooms que se baja si la zona no tiene imagen al elegido: en partes de Misiones
 * Esri llega a 17 aunque la capa llegue a 19. Más abajo la imagen ya no se lee.
 */
const ZOOMS_SIN_IMAGEN = 3;

/**
 * El zoom más alto, desde `elegido`, en el que toda el área tiene imagen; null
 * si ninguno. Rechaza si la fuente no pudo saberlo.
 */
export async function zoomConImagen(area: AreaMundo, elegido: number, fuente: FuenteTiles) {
  for (let zoom = elegido; zoom >= Math.max(0, elegido - ZOOMS_SIN_IMAGEN); zoom--) {
    if (await fuente.tieneImagen(zonaDelZoom(area, zoom))) return zoom;
  }
  return null;
}
