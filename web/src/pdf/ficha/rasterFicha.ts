import { MEDIDA_FICHA } from '../plantilla/tokens';
import type { MedidaImagen } from '../reducirImagen';

/** px por pt impreso de la foto y el minimapa: 3,5 son 252 ppp. */
const PX_POR_PT_FICHA = 3.5;

/**
 * El minimapa se dibuja chico y se imprime ampliado: los puntos, el anillo, el
 * norte y la escala salen así de veces más grandes, legibles a hoja entera.
 */
const AUMENTO_MINIMAPA = 1.5;

/** El dibujo del minimapa, en sus unidades: impreso, llena la caja a PX_POR_PT_FICHA. */
export const DIBUJO_MINIMAPA = {
  lado: MEDIDA_FICHA.ladoImagen / AUMENTO_MINIMAPA,
  escalaRender: PX_POR_PT_FICHA * AUMENTO_MINIMAPA,
  /** El norte y la escala quedan en este borde, sin tapar puntos. */
  margen: 20,
} as const;

const LADO_FOTO_PX = Math.round(MEDIDA_FICHA.ladoImagen * PX_POR_PT_FICHA);

/** Más chica que las fotos de la app (1200 px): esas se reducen, no se agrandan. */
export const MEDIDA_FOTO_FICHA: MedidaImagen = {
  ancho: LADO_FOTO_PX,
  alto: LADO_FOTO_PX,
  calidad: 0.8,
};
