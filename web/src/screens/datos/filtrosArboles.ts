import type { FiltrosArboles } from '../../queries/dataExplorerQueries';

/** Valores del filtro GPS; la cadena vacía es "todos" en el Select. */
export const FILTRO_GPS = {
  todos: '',
  con: 'con',
  sin: 'sin',
} as const;

export type FiltroGps = (typeof FILTRO_GPS)[keyof typeof FILTRO_GPS];

/** Valores del filtro de foto, con el mismo criterio que la columna Foto. */
export const FILTRO_FOTO = {
  todas: '',
  con: 'con',
  sin: 'sin',
} as const;

export type FiltroFoto = (typeof FILTRO_FOTO)[keyof typeof FILTRO_FOTO];

/** Estado de los filtros tal como vive en los selects ('' = sin filtro). */
export type FiltrosUi = {
  parcelaId: string;
  groupId: string;
  speciesId: string;
  gps: string;
  foto: string;
  busqueda: string;
};

export const FILTROS_INICIALES: FiltrosUi = {
  parcelaId: '',
  groupId: '',
  speciesId: '',
  gps: FILTRO_GPS.todos,
  foto: FILTRO_FOTO.todas,
  busqueda: '',
};

/** `''` (todos) → undefined; el resto, al booleano que espera la query. */
function aBooleano(valor: string, verdadero: string): boolean | undefined {
  return valor === '' ? undefined : valor === verdadero;
}

/** Traduce el estado de la UI a los filtros que entiende la query. */
export function aFiltrosArboles(filtros: FiltrosUi): FiltrosArboles {
  return {
    parcelaId: filtros.parcelaId || undefined,
    groupId: filtros.groupId || undefined,
    speciesId: filtros.speciesId || undefined,
    conGps: aBooleano(filtros.gps, FILTRO_GPS.con),
    conFoto: aBooleano(filtros.foto, FILTRO_FOTO.con),
    busqueda: filtros.busqueda.trim() || undefined,
  };
}
