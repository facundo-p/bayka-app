/*
 * Fotos de los árboles listas para el PDF: firmadas en una llamada, bajadas de a
 * pocas y reducidas a un JPEG chico. Una foto que falla queda como placeholder y
 * nunca corta el documento.
 */
import { mapearConConcurrencia } from '../lib/concurrencia';
import { firmarFotos, fotoSubida } from '../services/fotoService';
import { ESTADO_FOTO, type FotoPdf } from './estadoFoto';
import { reducirImagen, type MedidaImagen } from './reducirImagen';

const SIN_FOTO: FotoPdf = { estado: ESTADO_FOTO.sinFoto };
const NO_DISPONIBLE: FotoPdf = { estado: ESTADO_FOTO.noDisponible };

/** Cuadrada como el recuadro de la ficha (las 4:3 viejas se recortan al centro); 480 px alcanzan para 4 cm impresos. */
export const MEDIDA_FOTO_PDF: MedidaImagen = { ancho: 480, alto: 480, calidad: 0.75 };

/** Descargas simultáneas: más satura la conexión sin terminar antes. */
const DESCARGAS_SIMULTANEAS = 5;

async function firmarSinFallar(fotoUrls: string[]): Promise<Array<string | null>> {
  try {
    return await firmarFotos(fotoUrls);
  } catch {
    return fotoUrls.map(() => null);
  }
}

async function bajarYReducir(url: string | null): Promise<FotoPdf> {
  if (!url) return NO_DISPONIBLE;
  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) return NO_DISPONIBLE;
    const src = await reducirImagen(await respuesta.blob(), MEDIDA_FOTO_PDF);
    return { estado: ESTADO_FOTO.lista, src };
  } catch {
    return NO_DISPONIBLE;
  }
}

/** Una foto por árbol, en el mismo orden que `fotoUrls`. */
export async function cargarFotos(fotoUrls: ReadonlyArray<string | null>): Promise<FotoPdf[]> {
  const conFoto = fotoUrls.flatMap((fotoUrl, indice) => {
    const url = fotoSubida(fotoUrl);
    return url ? [{ url, indice }] : [];
  });
  const firmadas = await firmarSinFallar(conFoto.map(({ url }) => url));
  const cargadas = await mapearConConcurrencia(firmadas, DESCARGAS_SIMULTANEAS, bajarYReducir);
  const fotos = fotoUrls.map(() => SIN_FOTO);
  conFoto.forEach(({ indice }, posicion) => {
    fotos[indice] = cargadas[posicion];
  });
  return fotos;
}
