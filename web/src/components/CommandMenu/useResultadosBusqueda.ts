import { useEffect, useState } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import type { ScopeBusqueda } from '../../queries/buscarQueries';
import { buscar, type ResultadoBusqueda } from '../../queries/buscarQueries';

/** Retardo del debounce del input de búsqueda. */
const RETARDO_BUSQUEDA_MS = 200;

/** Busca y entrega la respuesta (un error entrega vacío) salvo que la búsqueda se haya
 *  cancelado antes; devuelve la cancelación. */
function buscarCancelable(
  texto: string,
  scope: ScopeBusqueda | undefined,
  entregar: (resultados: ResultadoBusqueda[]) => void,
): () => void {
  let vigente = true;
  buscar(texto, scope)
    .then((encontrados) => {
      if (vigente) entregar(encontrados);
    })
    .catch(() => {
      if (vigente) entregar([]);
    });
  return () => {
    vigente = false;
  };
}

/** Dispara la búsqueda combinada con debounce; ignora respuestas obsoletas. */
export function useResultadosBusqueda(texto: string, scope?: ScopeBusqueda): ResultadoBusqueda[] {
  const textoDemorado = useDebounce(texto, RETARDO_BUSQUEDA_MS);
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  useEffect(() => buscarCancelable(textoDemorado, scope, setResultados), [textoDemorado, scope]);
  return resultados;
}
