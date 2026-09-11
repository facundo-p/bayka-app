import type { ArbolDetalle } from '../../queries/dataExplorerQueries';
import { ESPECIE_NO_RESUELTA, NOMBRE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';

/** Dato ausente en las tablas y en el panel de Datos. */
export const SIN_DATO = '—';

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

/** null si el árbol no tiene parcela o la parcela no está entre las cargadas. */
export function codigoParcelaDe(arbol: ArbolDetalle, codigos: Map<string, string>): string | null {
  return (arbol.parcelaId && codigos.get(arbol.parcelaId)) || null;
}

/** null si no se sabe quién lo registró o el perfil no tiene nombre. */
export function nombreTecnicoDe(arbol: ArbolDetalle, nombres: Map<string, string>): string | null {
  return (arbol.usuarioRegistro && nombres.get(arbol.usuarioRegistro)) || null;
}
