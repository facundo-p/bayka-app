import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { FiltrosUi } from './filtrosArboles';
import { conFiltro, contarFiltros, filtrosAParams, leerFiltrosDeUrl } from './filtrosUrl';

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
  const limpiar = useCallback(() => setSearchParams(new URLSearchParams()), [setSearchParams]);
  const filtrosActivos = contarFiltros(filtros);
  return { filtros, setFiltro, limpiar, filtrosActivos, hayFiltro: filtrosActivos > 0 };
}
