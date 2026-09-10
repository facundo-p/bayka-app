import { useEffect, useId, useRef, type RefObject } from 'react';
import { useNavegacionTeclado } from './useNavegacionTeclado';

function idOpcion(idLista: string, indice: number): string {
  return `${idLista}-opcion-${indice}`;
}

/** Scroll mínimo para que la opción se vea: scrollIntoView movería también la página. */
export function mantenerVisible(lista: HTMLElement, opcion: HTMLElement) {
  const arriba = opcion.offsetTop;
  const abajo = arriba + opcion.offsetHeight;
  if (arriba < lista.scrollTop) lista.scrollTop = arriba;
  else if (abajo > lista.scrollTop + lista.clientHeight) {
    lista.scrollTop = abajo - lista.clientHeight;
  }
}

function useScrollAlResaltado(
  idLista: string,
  resaltado: number,
): RefObject<HTMLDivElement | null> {
  const refLista = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opcion = document.getElementById(idOpcion(idLista, resaltado));
    if (refLista.current && opcion) mantenerVisible(refLista.current, opcion);
  }, [idLista, resaltado]);
  return refLista;
}

function propsBuscador(idLista: string, cantidad: number, resaltado: number) {
  return {
    role: 'combobox',
    'aria-expanded': true,
    'aria-autocomplete': 'list',
    'aria-controls': idLista,
    'aria-activedescendant': cantidad > 0 ? idOpcion(idLista, resaltado) : undefined,
  } as const;
}

/**
 * Combobox con foco virtual sobre un listbox: el foco se queda en el buscador y
 * `aria-activedescendant` apunta a la opción resaltada. Los getters arman el
 * ARIA del buscador, la lista y cada opción con los mismos ids.
 */
export function useListboxNavegable(cantidad: number, alElegir: (indice: number) => void) {
  const idLista = useId();
  const navegacion = useNavegacionTeclado(cantidad, alElegir);
  const { resaltado, setResaltado } = navegacion;
  const refLista = useScrollAlResaltado(idLista, resaltado);
  return {
    ...navegacion,
    idLista,
    propsBuscador: () => propsBuscador(idLista, cantidad, resaltado),
    propsLista: () => ({ id: idLista, role: 'listbox', ref: refLista }) as const,
    propsOpcion: (indice: number) =>
      ({
        id: idOpcion(idLista, indice),
        role: 'option',
        'aria-selected': indice === resaltado,
        onMouseMove: () => setResaltado(indice),
      }) as const,
  };
}

export type PropsOpcion = ReturnType<ReturnType<typeof useListboxNavegable>['propsOpcion']>;
