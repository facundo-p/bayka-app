import { FILTRO_FOTO, FILTRO_GPS, FILTROS_INICIALES, type FiltrosUi } from './filtrosArboles';

/** Claves de query string que persisten el scope entre las secciones de Datos. */
export const PARAM_URL = {
  parcela: 'parcela',
  grupo: 'grupo',
  especie: 'especie',
  gps: 'gps',
  foto: 'foto',
  busqueda: 'q',
} as const;

type ParamUrl = (typeof PARAM_URL)[keyof typeof PARAM_URL];
type CampoFiltro = keyof FiltrosUi;

/** Lo que escribe la UI: se valida recién al volver a leerlo de la URL. */
export type FiltrosEscritos = Partial<Record<CampoFiltro, string>>;

const CAMPO_A_PARAM: Record<CampoFiltro, ParamUrl> = {
  parcelaId: PARAM_URL.parcela,
  groupId: PARAM_URL.grupo,
  speciesId: PARAM_URL.especie,
  gps: PARAM_URL.gps,
  foto: PARAM_URL.foto,
  busqueda: PARAM_URL.busqueda,
};

const CAMPOS = Object.keys(CAMPO_A_PARAM) as CampoFiltro[];

/** Campos de valores cerrados: uno ajeno en la URL (editada a mano) cuenta como "todos". */
const VALORES_VALIDOS: Partial<Record<CampoFiltro, readonly string[]>> = {
  gps: Object.values(FILTRO_GPS),
  foto: Object.values(FILTRO_FOTO),
};

function leerCampo(params: URLSearchParams, campo: CampoFiltro): string {
  const valor = params.get(CAMPO_A_PARAM[campo]);
  const validos = VALORES_VALIDOS[campo];
  if (valor === null || (validos && !validos.includes(valor))) return FILTROS_INICIALES[campo];
  return valor;
}

export function leerFiltrosDeUrl(params: URLSearchParams): FiltrosUi {
  // El cast lo respalda VALORES_VALIDOS, que acota gps y foto a sus uniones.
  return Object.fromEntries(CAMPOS.map((campo) => [campo, leerCampo(params, campo)])) as FiltrosUi;
}

export function hayFiltroActivo(filtros: FiltrosUi): boolean {
  return CAMPOS.some((campo) => filtros[campo] !== FILTROS_INICIALES[campo]);
}

/** Search params de un conjunto de filtros; los vacíos no se escriben. */
export function filtrosAParams(filtros: FiltrosEscritos): URLSearchParams {
  const params = new URLSearchParams();
  for (const campo of CAMPOS) {
    const valor = filtros[campo];
    if (valor) params.set(CAMPO_A_PARAM[campo], valor);
  }
  return params;
}
