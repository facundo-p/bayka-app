/*
 * Las piezas de estilo que repiten los tres PDF. Cada documento les pone sus
 * medidas; la forma es una sola.
 */
import {
  aireCentrado,
  COLOR_PDF,
  FUENTE_PDF,
  MEDIDA_PDF,
  type MedidaPunto,
  PESO_FUENTE,
} from './tokens';

/** La letra de los títulos de marca; el tamaño lo pone cada uno. */
export const letraDeTitulo = {
  fontFamily: FUENTE_PDF.titulo,
  fontWeight: PESO_FUENTE.bold,
  color: COLOR_PDF.navy,
} as const;

/** Un rótulo en mayúsculas espaciadas, en el color apagado. */
export const rotuloEnMayusculas = (fontSize: number) =>
  ({
    fontSize,
    color: COLOR_PDF.apagado,
    textTransform: 'uppercase',
    letterSpacing: MEDIDA_PDF.espaciadoMayusculas,
  }) as const;

/**
 * El punto de color de la especie, centrado en el primer renglón del nombre:
 * si el nombre se parte, el punto no baja.
 */
export const puntoDeEspecie = ({ diametro, aire }: MedidaPunto, altoRenglon: number) => ({
  width: diametro,
  height: diametro,
  borderRadius: diametro / 2,
  marginTop: aireCentrado(altoRenglon, diametro),
  marginRight: aire,
});
