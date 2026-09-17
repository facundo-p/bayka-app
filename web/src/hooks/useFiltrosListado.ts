import { useCallback, useMemo, useState } from 'react';
import { useBusquedaDemorada } from './useBusquedaDemorada';

/** Lo que la barra de un listado lee y cambia: el buscador y los filtros. */
export interface ControlesFiltros<F> {
  busqueda: string;
  onBuscar: (texto: string) => void;
  filtros: F;
  onFiltro: <K extends keyof F>(clave: K, valor: F[K]) => void;
}

type Filtrar<T, F> = (filas: T[], criterios: F & { busqueda: string }) => T[];

/**
 * Búsqueda y filtros de un listado, y las filas que los pasan. `filtrar` tiene
 * que ser estable (una función de módulo): si cambia, se vuelve a filtrar.
 */
export function useFiltrosListado<T, F extends object>(
  filas: T[] | undefined,
  filtrar: Filtrar<T, F>,
  iniciales: F,
) {
  const { busqueda, setBusqueda, busquedaDemorada } = useBusquedaDemorada();
  const [filtros, setFiltros] = useState(iniciales);
  const onFiltro = useCallback(<K extends keyof F>(clave: K, valor: F[K]) => {
    setFiltros((previos) => ({ ...previos, [clave]: valor }));
  }, []);
  const visibles = useMemo(
    () => filtrar(filas ?? [], { ...filtros, busqueda: busquedaDemorada }),
    [filas, filtrar, filtros, busquedaDemorada],
  );
  const controles: ControlesFiltros<F> = { busqueda, onBuscar: setBusqueda, filtros, onFiltro };
  return { controles, visibles };
}
