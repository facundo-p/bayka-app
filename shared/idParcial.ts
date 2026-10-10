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

type ConAlta<T> = { arbol: T; alta: number };

/** Un alta ilegible va al final: no se puede ubicar y no corre al resto. */
function conAlta<T extends ArbolNumerable>(arbol: T): ConAlta<T> {
  return { arbol, alta: microsegundosDesdeEpoch(arbol.grupoCreadoEn) ?? Number.MAX_SAFE_INTEGER };
}

// Por código de carácter, como compara los uuid Postgres; `localeCompare` depende del idioma.
function compararTexto(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compararPorIdParcial<T extends ArbolNumerable>(a: ConAlta<T>, b: ConAlta<T>): number {
  return (
    a.alta - b.alta ||
    a.arbol.posicion - b.arbol.posicion ||
    compararTexto(a.arbol.grupoId, b.arbol.grupoId) ||
    compararTexto(a.arbol.arbolId, b.arbol.arbolId)
  );
}

/** Los árboles de una plantación en orden de ID Parcial, numerados desde 1. */
export function numerarPorIdParcial<T extends ArbolNumerable>(
  arboles: readonly T[],
): (T & { idParcial: number })[] {
  // El alta se lee una vez por árbol y no en cada comparación del sort.
  return arboles
    .map(conAlta)
    .sort(compararPorIdParcial)
    .map(({ arbol }, i) => ({ ...arbol, idParcial: i + 1 }));
}
