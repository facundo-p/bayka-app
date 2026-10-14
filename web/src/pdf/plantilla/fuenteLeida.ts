/**
 * Lo que se usa, para medir y para sanear, de una fuente que leyó react-pdf: la
 * de fontkit de una registrada o el StandardFont de Helvetica responden igual.
 */
export type FuenteLeida = {
  unitsPerEm: number;
  layout(texto: string): { positions: ReadonlyArray<{ xAdvance: number }> };
  hasGlyphForCodePoint(codigo: number): boolean;
};
