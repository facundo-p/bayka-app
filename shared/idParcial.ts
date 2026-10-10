/**
 * ID Parcial: el número de un árbol dentro de su plantación (#822). No se guarda:
 * web y mobile lo calculan al exportar, con el orden que usaba `generate_tree_ids`
 * (alta del grupo, posición del árbol, id del grupo). El id del árbol desempata
 * lo que ese orden dejaba al azar, para que las dos apps numeren igual.
 */
import { microsegundosDesdeEpoch } from './instante';

export type ArbolNumerable = {
  arbolId: string;
  grupoId: string;
  /** `created_at` del grupo, con el formato que tenga (server o teléfono). */
  grupoCreadoEn: string;
  posicion: number;
};

/** Un alta ilegible va al final: no se puede ubicar y no corre al resto. */
function altaDelGrupo(arbol: ArbolNumerable): number {
  return microsegundosDesdeEpoch(arbol.grupoCreadoEn) ?? Number.MAX_SAFE_INTEGER;
}

// Por código de carácter, como compara los uuid Postgres; `localeCompare` depende del idioma.
function compararTexto(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function compararPorIdParcial(a: ArbolNumerable, b: ArbolNumerable): number {
  return (
    altaDelGrupo(a) - altaDelGrupo(b) ||
    a.posicion - b.posicion ||
    compararTexto(a.grupoId, b.grupoId) ||
    compararTexto(a.arbolId, b.arbolId)
  );
}

/** Los árboles de una plantación en orden de ID Parcial, numerados desde 1. */
export function numerarPorIdParcial<T extends ArbolNumerable>(
  arboles: readonly T[],
): (T & { idParcial: number })[] {
  return [...arboles].sort(compararPorIdParcial).map((arbol, i) => ({ ...arbol, idParcial: i + 1 }));
}
