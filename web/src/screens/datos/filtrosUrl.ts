import type { FiltrosUi } from './filtrosArboles';
import { FILTROS_INICIALES } from './filtrosArboles';

/** Claves de query string que persisten el scope entre sub-tabs de Datos. */
export const PARAM_PARCELA = 'parcela';
export const PARAM_GRUPO = 'grupo';
export const PARAM_ESPECIE = 'especie';
export const PARAM_GPS = 'gps';
export const PARAM_BUSQUEDA = 'q';

/** Mapeo campo de filtro UI → clave en la URL. */
const CAMPO_A_PARAM: Record<keyof FiltrosUi, string> = {
  parcelaId: PARAM_PARCELA,
  groupId: PARAM_GRUPO,
  speciesId: PARAM_ESPECIE,
  gps: PARAM_GPS,
  busqueda: PARAM_BUSQUEDA,
};

/** Lee los filtros desde los search params de la URL (vacío = sin filtro). */
export function leerFiltrosDeUrl(params: URLSearchParams): FiltrosUi {
  return {
    parcelaId: params.get(PARAM_PARCELA) ?? '',
    groupId: params.get(PARAM_GRUPO) ?? '',
    speciesId: params.get(PARAM_ESPECIE) ?? '',
    gps: params.get(PARAM_GPS) ?? '',
    busqueda: params.get(PARAM_BUSQUEDA) ?? '',
  };
}

/** true si algún filtro está activo (distinto del estado inicial). */
export function hayFiltroActivo(filtros: FiltrosUi): boolean {
  return (Object.keys(FILTROS_INICIALES) as Array<keyof FiltrosUi>).some(
    (campo) => filtros[campo] !== FILTROS_INICIALES[campo],
  );
}

/** Construye los search params para un conjunto de filtros (omite los vacíos). */
export function filtrosAParams(filtros: Partial<FiltrosUi>): URLSearchParams {
  const params = new URLSearchParams();
  for (const campo of Object.keys(CAMPO_A_PARAM) as Array<keyof FiltrosUi>) {
    const valor = filtros[campo];
    if (valor) params.set(CAMPO_A_PARAM[campo], valor);
  }
  return params;
}
