import { contexto2d, crearCanvas, exportarYLiberar } from './canvas';

export type MedidaImagen = { ancho: number; alto: number; calidad: number };

export type Recorte = { x: number; y: number; ancho: number; alto: number };

const TIPO_JPEG = 'image/jpeg';

/** La parte central de la imagen con la proporción pedida, como `object-fit: cover`. */
export function recorteCubriendo(ancho: number, alto: number, proporcion: number): Recorte {
  if (ancho / alto > proporcion) {
    const anchoRecorte = alto * proporcion;
    return { x: (ancho - anchoRecorte) / 2, y: 0, ancho: anchoRecorte, alto };
  }
  const altoRecorte = ancho / proporcion;
  return { x: 0, y: (alto - altoRecorte) / 2, ancho, alto: altoRecorte };
}

/** Vía <img> y no `createImageBitmap`: así también decodifica SVG, como la foto de la demo. */
function cargarImagen(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise<HTMLImageElement>((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error('No se pudo decodificar la imagen'));
    imagen.src = url;
  }).finally(() => URL.revokeObjectURL(url));
}

/** Recorta al centro, escala a la medida y la devuelve como data URL JPEG. */
export async function reducirImagen(blob: Blob, medida: MedidaImagen): Promise<string> {
  const imagen = await cargarImagen(blob);
  const recorte = recorteCubriendo(
    imagen.naturalWidth,
    imagen.naturalHeight,
    medida.ancho / medida.alto,
  );
  const canvas = crearCanvas(medida.ancho, medida.alto);
  const { x, y, ancho, alto } = recorte;
  contexto2d(canvas).drawImage(imagen, x, y, ancho, alto, 0, 0, canvas.width, canvas.height);
  return exportarYLiberar(canvas, TIPO_JPEG, medida.calidad);
}
