import { SEPARADOR_PUNTO } from '../../lib/formato';

/** Textos fijos de la plantilla de página: encabezado y pie. */
export const TEXTO_PLANTILLA = {
  marca: 'Bayka',
  separador: SEPARADOR_PUNTO,
  emitido: 'Emitido el',
  pagina: 'Página',
  de: 'de',
} as const;

/** Encabezado de cada hoja: logo a la izquierda, la plantación a la derecha. */
export type EncabezadoPdf = {
  logo: string;
  /** «Lugar · Período». */
  titulo: string;
};

/** Lo que cada hoja repite: el encabezado y la fecha de emisión, ya formateada, del pie. */
export type EmisionPdf = { encabezado: EncabezadoPdf; emitido: string };

export type PlantacionDelEncabezado = { lugar: string; periodo: string };

export function encabezadoDePlantacion(
  plantacion: PlantacionDelEncabezado,
  logo: string,
): EncabezadoPdf {
  return { logo, titulo: `${plantacion.lugar}${TEXTO_PLANTILLA.separador}${plantacion.periodo}` };
}

/** «Emitido el 06/10/2026 · Página 1 de 3». */
export function textoPiePagina(emitido: string, pagina: number, total: number): string {
  const { emitido: rotulo, separador, pagina: rotuloPagina, de } = TEXTO_PLANTILLA;
  return `${rotulo} ${emitido}${separador}${rotuloPagina} ${pagina} ${de} ${total}`;
}
