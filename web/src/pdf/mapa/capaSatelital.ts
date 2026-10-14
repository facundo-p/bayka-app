/*
 * El satélite como fondo del mapa (#757). Si falla cualquier tile, el mapa
 * sale liso y sin atribución: nunca un mosaico a medias.
 */
import { fuenteSatelite, type FuenteTiles } from '../../lib/mapa/fuenteTiles';
import { zoomConImagen } from '../../lib/mapa/zoomConImagen';
import type { CapaFondo } from './dibujarMapa';
import type { Encuadre } from './proyeccion';
import { elegirZoom, tilesDelZoom, type TileUbicado } from './tiles';

/** Al achicar un tile grande, el suavizado alto evita el serrucho. */
const SUAVIZADO = 'high';

type Mosaico = { tiles: TileUbicado[]; imagenes: ImageBitmap[] };

async function bajarMosaico(
  encuadre: Encuadre,
  tope: number,
  fuente: FuenteTiles,
): Promise<Mosaico | null> {
  try {
    const zoom = await zoomConImagen(encuadre, elegirZoom(encuadre, tope), fuente);
    if (zoom === null) return null;
    const tiles = tilesDelZoom(encuadre, zoom);
    // Un encuadre fuera del mundo no tiene tiles: sin imagen, tampoco atribución.
    if (tiles.length === 0) return null;
    return { tiles, imagenes: await fuente.cargar(tiles) };
  } catch {
    return null;
  }
}

export type Rectangulo = { x: number; y: number; ancho: number; alto: number };

/** Bordes llevados al px del canvas hacia afuera: dos tiles vecinos se pisan en vez de dejar una raya. */
export function rectanguloAlPixel({ destino, lado }: TileUbicado, escala: number): Rectangulo {
  const x = Math.floor(destino.x * escala) / escala;
  const y = Math.floor(destino.y * escala) / escala;
  const derecha = Math.ceil((destino.x + lado) * escala) / escala;
  const abajo = Math.ceil((destino.y + lado) * escala) / escala;
  return { x, y, ancho: derecha - x, alto: abajo - y };
}

function pintarMosaico(
  contexto: CanvasRenderingContext2D,
  { tiles, imagenes }: Mosaico,
  escalaRender: number,
) {
  contexto.imageSmoothingQuality = SUAVIZADO;
  tiles.forEach((tile, indice) => {
    const { x, y, ancho, alto } = rectanguloAlPixel(tile, escalaRender);
    contexto.drawImage(imagenes[indice], x, y, ancho, alto);
  });
}

/** Fondo satelital de hasta `tope` tiles; null al prepararlo si no se pudo bajar. */
export function capaSatelital(tope: number, fuente = fuenteSatelite): CapaFondo {
  return async (encuadre) => {
    const mosaico = await bajarMosaico(encuadre, tope, fuente);
    if (!mosaico) return null;
    return {
      pintar: (contexto, escalaRender) => pintarMosaico(contexto, mosaico, escalaRender),
      liberar: () => mosaico.imagenes.forEach((imagen) => imagen.close()),
    };
  };
}
