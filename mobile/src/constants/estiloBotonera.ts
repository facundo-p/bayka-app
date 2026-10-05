import { fontSize } from '../theme';

/** Qué texto va arriba, en negrita, en los botones de la botonera de especies (#744). */
export const ORDEN_BOTONERA = {
  codigoArriba: 'codigo-arriba',
  nombreArriba: 'nombre-arriba',
} as const;

export type OrdenBotonera = (typeof ORDEN_BOTONERA)[keyof typeof ORDEN_BOTONERA];

/** Tamaños de letra elegibles para el código y el nombre. */
export const TAMANO_LETRA_BOTONERA = { min: 9, max: 24 } as const;

export interface EstiloBotonera {
  orden: OrdenBotonera;
  tamanoCodigo: number;
  tamanoNombre: number;
}

export type TamanoDeBotonera = Exclude<keyof EstiloBotonera, 'orden'>;

/** El diseño de siempre: código arriba y grande, nombre abajo y chico. */
export const ESTILO_BOTONERA_ORIGINAL: Readonly<EstiloBotonera> = {
  orden: ORDEN_BOTONERA.codigoArriba,
  tamanoCodigo: fontSize.xxl,
  tamanoNombre: fontSize.xs,
};
