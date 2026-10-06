import { SEPARADOR_PUNTO } from '../../lib/formato';

/** Textos fijos de la plantilla de página: encabezado y pie. */
export const TEXTO_PLANTILLA = {
  marca: 'Bayka',
  separador: SEPARADOR_PUNTO,
  plantacion: 'Plantación',
  organizacion: 'Organización',
  emitido: 'Emitido el',
  pagina: 'Página',
  de: 'de',
} as const;

/** Encabezado de cada hoja: logo a la izquierda, la plantación a la derecha. */
export type EncabezadoPdf = {
  logo: string;
  /** «Lugar · Período». */
  titulo: string;
  /** «Plantación CÓDIGO · Organización NOMBRE». */
  detalle: string;
};

type PlantacionDelEncabezado = { lugar: string; periodo: string; codigo: string };

/** Sin organización legible, el detalle lleva solo el código. */
export function encabezadoDePlantacion(
  plantacion: PlantacionDelEncabezado,
  organizacion: string | null,
  logo: string,
): EncabezadoPdf {
  const { separador } = TEXTO_PLANTILLA;
  const partes = [`${TEXTO_PLANTILLA.plantacion} ${plantacion.codigo}`];
  if (organizacion) partes.push(`${TEXTO_PLANTILLA.organizacion} ${organizacion}`);
  return {
    logo,
    titulo: `${plantacion.lugar}${separador}${plantacion.periodo}`,
    detalle: partes.join(separador),
  };
}

/** «Emitido el 06/10/2026 · Página 1 de 3». */
export function textoPiePagina(emitido: string, pagina: number, total: number): string {
  const { emitido: rotulo, separador, pagina: rotuloPagina, de } = TEXTO_PLANTILLA;
  return `${rotulo} ${emitido}${separador}${rotuloPagina} ${pagina} ${de} ${total}`;
}
