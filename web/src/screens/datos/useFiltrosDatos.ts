import { useCallback, useMemo } from 'react';
import { useSearchParams, type SetURLSearchParams } from 'react-router';
import { limpiarFiltros } from '../../lib/filtros';
import { FILTROS_INICIALES, type FiltrosUi } from './filtrosArboles';
import {
  conFiltro,
  contarFiltros,
  filtrosAParams,
  hayFiltroOBusqueda,
  leerFiltrosDeUrl,
} from './filtrosUrl';

/**
 * `limpiar` es el del panel: la búsqueda queda a la vista y no la toca.
 * `limpiarTodo` es el de la tabla vacía, que se vacía igual por la búsqueda.
 */
function useLimpiar(filtros: FiltrosUi, setSearchParams: SetURLSearchParams) {
  const limpiar = useCallback(
    () => setSearchParams(filtrosAParams(limpiarFiltros(filtros, FILTROS_INICIALES))),
    [filtros, setSearchParams],
  );
  const limpiarTodo = useCallback(() => setSearchParams(new URLSearchParams()), [setSearchParams]);
  return { limpiar, limpiarTodo };
}

/**
 * Filtros del explorador de datos persistidos en la URL: sobreviven el cambio
 * de sub-tab y hacen la vista compartible/bookmarkeable.
 */
export function useFiltrosDatos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filtros = useMemo(() => leerFiltrosDeUrl(searchParams), [searchParams]);
  const setFiltro = useCallback(
    (campo: keyof FiltrosUi, valor: string) =>
      setSearchParams(filtrosAParams(conFiltro(filtros, campo, valor)), { replace: true }),
    [filtros, setSearchParams],
  );
  const limpiezas = useLimpiar(filtros, setSearchParams);
  return {
    filtros,
    setFiltro,
    ...limpiezas,
    filtrosActivos: contarFiltros(filtros),
    hayFiltroOBusqueda: hayFiltroOBusqueda(filtros),
  };
}

/**
 * Filtros de la URL más la búsqueda por código o nombre de Parcelas y Grupos.
 * `filtrosBusqueda` es el de la tabla vacía: ahí solo la búsqueda se limpia,
 * así no se suelta la parcela en scope.
 */
export function useBusquedaDatos() {
  const filtrosDatos = useFiltrosDatos();
  const buscar = (texto: string) => filtrosDatos.setFiltro('busqueda', texto);
  const { filtros } = filtrosDatos;
  return {
    ...filtrosDatos,
    buscar,
    filtrosBusqueda: { activos: filtros.busqueda ? 1 : 0, onLimpiar: () => buscar('') },
  };
}
