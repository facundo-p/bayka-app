/*
 * Fotos de los árboles listas para el PDF: firmadas en una llamada, bajadas de a
 * pocas y reducidas a un JPEG chico. Una foto que falla queda como placeholder y
 * nunca corta el documento; cancelar sí lo corta.
 */
import { mapearConConcurrencia } from '../lib/concurrencia';
import { firmarFotos, fotoSubida } from '../services/fotoService';
import { ESTADO_FOTO, type FotoPdf } from './estadoFoto';
import { reducirImagen, type MedidaImagen } from './reducirImagen';

const SIN_FOTO: FotoPdf = { estado: ESTADO_FOTO.sinFoto };
const NO_DISPONIBLE: FotoPdf = { estado: ESTADO_FOTO.noDisponible };

/**
 * Foto chica por defecto, la de las tarjetas del reporte; la ficha de hoja
 * entera usa `MEDIDA_FOTO_FICHA`. Cuadrada: las 4:3 viejas se recortan al centro.
 */
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

/** Un fetch cortado por la cancelación no es una foto fallida: se propaga. */
async function bajarYReducir(
  url: string | null,
  medida: MedidaImagen,
  senal?: AbortSignal,
): Promise<FotoPdf> {
  if (!url) return NO_DISPONIBLE;
  try {
    const respuesta = await fetch(url, { signal: senal });
    if (!respuesta.ok) return NO_DISPONIBLE;
    const src = await reducirImagen(await respuesta.blob(), medida);
    return { estado: ESTADO_FOTO.lista, src };
  } catch {
    senal?.throwIfAborted();
    return NO_DISPONIBLE;
  }
}

export type OpcionesCargaFotos = {
  /** `MEDIDA_FOTO_PDF` si no se indica. */
  medida?: MedidaImagen;
  /** Fotos terminadas, bajadas o fallidas, sobre las que hay que bajar. Arranca en 0. */
  alProgresar?: (listas: number, total: number) => void;
  /** Al abortarla no se lanzan más descargas, se cortan las que siguen y se rechaza con su motivo. */
  senal?: AbortSignal;
};

/** Baja de a pocas y avisa cada una que termina. */
async function bajarTodas(
  firmadas: Array<string | null>,
  { medida = MEDIDA_FOTO_PDF, alProgresar, senal }: OpcionesCargaFotos,
): Promise<FotoPdf[]> {
  let listas = 0;
  return mapearConConcurrencia(firmadas, DESCARGAS_SIMULTANEAS, async (url) => {
    senal?.throwIfAborted();
    const foto = await bajarYReducir(url, medida, senal);
    alProgresar?.(++listas, firmadas.length);
    return foto;
  });
}

/** Una foto por árbol, en el mismo orden que `fotoUrls`. */
export async function cargarFotos(
  fotoUrls: ReadonlyArray<string | null>,
  opciones: OpcionesCargaFotos = {},
): Promise<FotoPdf[]> {
  const conFoto = fotoUrls.flatMap((fotoUrl, indice) => {
    const url = fotoSubida(fotoUrl);
    return url ? [{ url, indice }] : [];
  });
  opciones.senal?.throwIfAborted();
  opciones.alProgresar?.(0, conFoto.length);
  const firmadas = await firmarSinFallar(conFoto.map(({ url }) => url));
  const cargadas = await bajarTodas(firmadas, opciones);
  const fotos = fotoUrls.map(() => SIN_FOTO);
  conFoto.forEach(({ indice }, posicion) => {
    fotos[indice] = cargadas[posicion];
  });
  return fotos;
}
