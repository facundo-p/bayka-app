import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { FiltrosUi } from './filtrosArboles';
import { filtrosAParams, hayFiltroActivo, leerFiltrosDeUrl } from './filtrosUrl';

/**
 * Filtros del explorador de datos persistidos en la URL: sobreviven el cambio
 * de sub-tab y hacen la vista compartible/bookmarkeable.
 */
export function useFiltrosDatos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filtros = useMemo(() => leerFiltrosDeUrl(searchParams), [searchParams]);

  /** Cambiar de parcela resetea el grupo (deja de tener sentido el scope viejo). */
  const setFiltro = useCallback(
    (campo: keyof FiltrosUi, valor: string) => {
      const proximos: FiltrosUi = {
        ...filtros,
        [campo]: valor,
        ...(campo === 'parcelaId' ? { groupId: '' } : {}),
      };
      setSearchParams(filtrosAParams(proximos), { replace: true });
    },
    [filtros, setSearchParams],
  );

  const limpiar = useCallback(() => setSearchParams(new URLSearchParams()), [setSearchParams]);

  return { filtros, setFiltro, limpiar, hayFiltro: hayFiltroActivo(filtros) };
}
