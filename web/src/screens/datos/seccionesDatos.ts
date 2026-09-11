/** Secciones de la tab Datos: cada valor es el sub-segmento de su ruta. */
export const SEGMENTO_DATOS = {
  parcelas: 'parcelas',
  grupos: 'grupos',
  arboles: 'arboles',
} as const;

export type SegmentoDatos = (typeof SEGMENTO_DATOS)[keyof typeof SEGMENTO_DATOS];

/** Ruta relativa a una sección hermana, con los filtros en el querystring. */
export function rutaSeccion(segmento: SegmentoDatos, filtros?: URLSearchParams): string {
  const query = filtros?.toString();
  return query ? `../${segmento}?${query}` : `../${segmento}`;
}
