/*
 * Descarga de tiles satelitales con caché de sesión: 50 fichas de una misma
 * parcela comparten encuadre y bajan cada tile una sola vez.
 */
import { crearLimitador, type Limitador } from '../../lib/concurrencia';
import {
  partirEnPaquetes,
  urlDeTile,
  urlDisponibilidad,
  type TileXYZ,
  type ZonaTiles,
} from './tiles';

/** Esri sirve por HTTP/1.1: el navegador no abre más de 6 conexiones por host. */
const TILES_EN_PARALELO = 6;
const ESPERA_TILE_MS = 8000;
/** Unos 30 KB por tile: el tope deja la caché en decenas de MB. */
const ENTRADAS_EN_CACHE = 1000;
/** Valor del tilemap para un tile con imagen. */
const CON_IMAGEN = 1;

export type DependenciasTiles = {
  bajar: (url: string, senal: AbortSignal) => Promise<Response>;
  decodificar: (imagen: Blob) => Promise<ImageBitmap>;
};

export type FuenteTiles = {
  /** Si todos los tiles de la zona tienen imagen; rechaza si no se pudo saber. */
  tieneImagen: (zona: ZonaTiles) => Promise<boolean>;
  /** Las imágenes de los tiles, en el mismo orden; rechaza si falta cualquiera. */
  cargar: (tiles: readonly TileXYZ[]) => Promise<ImageBitmap[]>;
};

type Tilemap = {
  data: number[];
  location: { left: number; top: number; width: number; height: number };
};

const DEPENDENCIAS_NAVEGADOR: DependenciasTiles = {
  bajar: (url, senal) => fetch(url, { signal: senal }),
  decodificar: (imagen) => createImageBitmap(imagen),
};

/** Un tile fuera de lo que devolvió el tilemap cuenta como sin imagen. */
function zonaConImagen({ data, location }: Tilemap, { x, y }: ZonaTiles): boolean {
  const { left, top, width, height } = location;
  if (x.primero < left || y.primero < top) return false;
  if (x.ultimo >= left + width || y.ultimo >= top + height) return false;
  for (let fila = y.primero; fila <= y.ultimo; fila++) {
    for (let columna = x.primero; columna <= x.ultimo; columna++) {
      if (data[(fila - top) * width + (columna - left)] !== CON_IMAGEN) return false;
    }
  }
  return true;
}

/** Si falla una, las que sí se decodificaron se liberan antes de rechazar. */
async function decodificarTodas(
  imagenes: readonly Blob[],
  decodificar: DependenciasTiles['decodificar'],
): Promise<ImageBitmap[]> {
  const resultados = await Promise.allSettled(imagenes.map(decodificar));
  const listas = resultados.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  if (listas.length === imagenes.length) return listas;
  listas.forEach((imagen) => imagen.close());
  throw new Error('No se pudo decodificar un tile');
}

/** Memoriza por clave lo que salió bien; un error se reintenta en el próximo pedido. */
function memorizar<T>(pedir: (clave: string) => Promise<T>): (clave: string) => Promise<T> {
  const cache = new Map<string, Promise<T>>();
  return (clave) => {
    const guardado = cache.get(clave);
    if (guardado) return guardado;
    if (cache.size >= ENTRADAS_EN_CACHE) cache.delete(cache.keys().next().value as string);
    const pedido = pedir(clave);
    cache.set(clave, pedido);
    // Si ya la desalojaron y hay un pedido nuevo con la misma clave, no se borra ese.
    pedido.catch(() => cache.get(clave) === pedido && cache.delete(clave));
    return pedido;
  };
}

/** Pedido acotado por el limitador; el cuerpo se lee adentro, con el mismo timeout. */
function pedidoCon(dependencias: DependenciasTiles, limitar: Limitador) {
  return <T>(leer: (respuesta: Response) => Promise<T>) =>
    (url: string) =>
      limitar(async () => {
        const respuesta = await dependencias.bajar(url, AbortSignal.timeout(ESPERA_TILE_MS));
        if (!respuesta.ok) throw new Error(`${url}: ${respuesta.status}`);
        return leer(respuesta);
      });
}

export function crearFuenteTiles(dependencias = DEPENDENCIAS_NAVEGADOR): FuenteTiles {
  const pedido = pedidoCon(dependencias, crearLimitador(TILES_EN_PARALELO));
  const imagen = memorizar(pedido((respuesta) => respuesta.blob()));
  const tilemap = memorizar(pedido((respuesta): Promise<Tilemap> => respuesta.json()));
  return {
    tieneImagen: async (zona) => {
      const partes = partirEnPaquetes(zona);
      const mapas = await Promise.all(partes.map((parte) => tilemap(urlDisponibilidad(parte))));
      return partes.every((parte, indice) => zonaConImagen(mapas[indice], parte));
    },
    cargar: async (tiles) => {
      const imagenes = await Promise.all(tiles.map((tile) => imagen(urlDeTile(tile))));
      return decodificarTodas(imagenes, dependencias.decodificar);
    },
  };
}

/** Una para toda la sesión: la caché sirve entre un PDF y el siguiente. */
export const fuenteSatelite = crearFuenteTiles();
