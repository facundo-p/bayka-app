import type { ArbolDetalle } from '../../queries/dataExplorerQueries';

export { etiquetaEspecie, nombreTecnicoDe, SIN_DATO } from '../../lib/formato';

export type ArbolConGps = ArbolDetalle & { latitude: number; longitude: number };

/** Sin las dos coordenadas no hay punto: nunca se muestra "0,0". */
export function tieneGps(arbol: ArbolDetalle): arbol is ArbolConGps {
  return arbol.latitude != null && arbol.longitude != null;
}

/** null si el árbol no tiene parcela o la parcela no está entre las cargadas. */
export function codigoParcelaDe(arbol: ArbolDetalle, codigos: Map<string, string>): string | null {
  return (arbol.parcelaId && codigos.get(arbol.parcelaId)) || null;
}
