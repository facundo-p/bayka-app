/**
 * Rutas de la web. Viven fuera de `screens/` porque las arman también quienes
 * navegan desde afuera de cada pantalla, como la búsqueda global.
 */

/** Raíz de cada pantalla. `establecerPassword` es además el destino del link
 *  de invitación que arma la función `admin-users`. */
export const RUTA = {
  login: '/login',
  establecerPassword: '/establecer-password',
  plantaciones: '/plantaciones',
  especies: '/especies',
  novedades: '/novedades',
  usuarios: '/usuarios',
} as const;

/** Patrón del detalle para el router; el id llega como `useParams().id`. */
export const PATRON_DETALLE_PLANTACION = `${RUTA.plantaciones}/:id`;

/** Tabs del detalle con segmento propio; el dashboard es la ruta índice. */
export const TAB_DETALLE = {
  datos: 'datos',
  configuracion: 'configuracion',
} as const;

export type TabDetalle = (typeof TAB_DETALLE)[keyof typeof TAB_DETALLE];

/** Secciones de la tab Datos: cada valor es el sub-segmento de su ruta. */
export const SEGMENTO_DATOS = {
  parcelas: 'parcelas',
  grupos: 'grupos',
  arboles: 'arboles',
} as const;

export type SegmentoDatos = (typeof SEGMENTO_DATOS)[keyof typeof SEGMENTO_DATOS];

/** Claves de query string que persisten el scope entre las secciones de Datos. */
export const PARAM_URL = {
  parcela: 'parcela',
  grupo: 'grupo',
  especie: 'especie',
  gps: 'gps',
  foto: 'foto',
  busqueda: 'q',
} as const;

export type ParamUrl = (typeof PARAM_URL)[keyof typeof PARAM_URL];

function conQuery(ruta: string, params?: URLSearchParams): string {
  const query = params?.toString();
  return query ? `${ruta}?${query}` : ruta;
}

/** Detalle de una plantación; sin tab, su dashboard. */
export function rutaPlantacion(plantacionId: string, tab?: TabDetalle): string {
  const detalle = `${RUTA.plantaciones}/${plantacionId}`;
  return tab ? `${detalle}/${tab}` : detalle;
}

/** Sección de Datos desde afuera del detalle, con los filtros en el querystring. */
export function rutaDatos(
  plantacionId: string,
  segmento: SegmentoDatos,
  filtros?: URLSearchParams,
): string {
  return conQuery(`${rutaPlantacion(plantacionId, TAB_DETALLE.datos)}/${segmento}`, filtros);
}

/** Sección hermana, relativa a la actual, con los filtros en el querystring. */
export function rutaSeccion(segmento: SegmentoDatos, filtros?: URLSearchParams): string {
  return conQuery(`../${segmento}`, filtros);
}
