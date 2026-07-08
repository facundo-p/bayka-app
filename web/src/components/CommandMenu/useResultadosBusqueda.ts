import { useEffect, useState } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import type { ScopeBusqueda } from '../../queries/buscarQueries';
import { buscar, type ResultadoBusqueda } from '../../queries/buscarQueries';

/** Retardo del debounce del input de búsqueda. */
const RETARDO_BUSQUEDA_MS = 200;

/** Dispara la búsqueda combinada con debounce; ignora respuestas obsoletas. */
export function useResultadosBusqueda(
  texto: string,
  scope?: ScopeBusqueda,
): ResultadoBusqueda[] {
  const textoDemorado = useDebounce(texto, RETARDO_BUSQUEDA_MS);
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);

  useEffect(() => {
    let vigente = true;
    buscar(textoDemorado, scope)
      .then((encontrados) => {
        if (vigente) setResultados(encontrados);
      })
      .catch(() => {
        if (vigente) setResultados([]);
      });
    return () => {
      vigente = false;
    };
  }, [textoDemorado, scope]);

  return resultados;
}
