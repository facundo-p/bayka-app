import type { ArbolDetalle } from '../../queries/dataExplorerQueries';
import { ESPECIE_NO_RESUELTA, NOMBRE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';

export type ArbolConGps = ArbolDetalle & { latitude: number; longitude: number };

/** Sin las dos coordenadas no hay punto: nunca se muestra "0,0". */
export function tieneGps(arbol: ArbolDetalle): arbol is ArbolConGps {
  return arbol.latitude != null && arbol.longitude != null;
}

/** "código · nombre" de la especie, con N/N si el árbol no la tiene. */
export function etiquetaEspecie(arbol: ArbolDetalle): string {
  const codigo = arbol.especieCodigo ?? ESPECIE_NO_RESUELTA;
  const nombre = arbol.especieNombre ?? NOMBRE_SIN_IDENTIFICAR;
  return `${codigo} · ${nombre}`;
}
