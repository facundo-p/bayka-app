import type { FiltrosArboles } from '../../queries/dataExplorerQueries';

/* Valores del filtro GPS ('' = todos). */
export const GPS_CON = 'con';
export const GPS_SIN = 'sin';

/** Estado de los filtros tal como vive en los selects ('' = sin filtro). */
export type FiltrosUi = {
  parcelaId: string;
  groupId: string;
  speciesId: string;
  gps: string;
  busqueda: string;
};

export const FILTROS_INICIALES: FiltrosUi = {
  parcelaId: '',
  groupId: '',
  speciesId: '',
  gps: '',
  busqueda: '',
};

/** Traduce el estado de la UI a los filtros que entiende la query. */
export function aFiltrosArboles(filtros: FiltrosUi): FiltrosArboles {
  return {
    parcelaId: filtros.parcelaId || undefined,
    groupId: filtros.groupId || undefined,
    speciesId: filtros.speciesId || undefined,
    conGps: filtros.gps === '' ? undefined : filtros.gps === GPS_CON,
    busqueda: filtros.busqueda.trim() || undefined,
  };
}
