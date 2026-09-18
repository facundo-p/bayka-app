/**
 * Clasificación única de los errores de guardado de la web: falla de red,
 * falta de permiso (RLS/403) o rechazo del servidor. Cada formulario arma su
 * mensaje con `mensajeDeError` en vez de decir siempre "revisá tu conexión".
 */
import { PG_ERROR } from './postgresErrorCodes';

export const TIPO_ERROR = {
  red: 'red',
  permiso: 'permiso',
  servidor: 'servidor',
} as const;

export type TipoError = (typeof TIPO_ERROR)[keyof typeof TIPO_ERROR];

/** Campos que pueden traer un PostgrestError, un FunctionsError o un Error de fetch. */
type DatosDeError = { message?: unknown; code?: unknown; status?: unknown; name?: unknown };

const HTTP_PROHIBIDO = 403;

/** fetch rechaza con TypeError: "Failed to fetch" (Chromium), "NetworkError when attempting
 *  to fetch resource." (Firefox), "Load failed" (Safari); supabase-js lo devuelve como
 *  `error.message = "TypeError: <eso>"`. Las functions lanzan FunctionsFetchError. */
const PATRON_RED = /failed to fetch|networkerror|load failed|network request failed/i;
const NOMBRE_ERROR_RED_FUNCTIONS = 'FunctionsFetchError';

/** Rechazo por RLS o por GRANT cuando el código no llegó (p.ej. repositorio que solo relanzó el mensaje). */
const PATRON_PERMISO = /row-level security|permission denied|insufficient_privilege/i;

function datosDe(error: unknown): DatosDeError {
  return typeof error === 'object' && error !== null ? (error as DatosDeError) : {};
}

function mensajeDe(error: unknown): string {
  const { message } = datosDe(error);
  return typeof message === 'string' ? message.trim() : '';
}

export function clasificarError(error: unknown): TipoError {
  const { code, status, name } = datosDe(error);
  const mensaje = mensajeDe(error);
  if (name === NOMBRE_ERROR_RED_FUNCTIONS || PATRON_RED.test(mensaje)) return TIPO_ERROR.red;
  if (
    code === PG_ERROR.INSUFFICIENT_PRIVILEGE ||
    status === HTTP_PROHIBIDO ||
    PATRON_PERMISO.test(mensaje)
  ) {
    return TIPO_ERROR.permiso;
  }
  return TIPO_ERROR.servidor;
}

/** Mensaje para el usuario según la causa. `accion` en infinitivo: "guardar la plantación". */
export function mensajeDeError(error: unknown, accion: string): string {
  const tipo = clasificarError(error);
  if (tipo === TIPO_ERROR.red) return `No se pudo ${accion}. Revisá tu conexión y probá de nuevo.`;
  if (tipo === TIPO_ERROR.permiso) return `No tenés permiso para ${accion}.`;
  const detalle = mensajeDe(error);
  return detalle
    ? `No se pudo ${accion}: el servidor rechazó el cambio (${detalle}).`
    : `No se pudo ${accion}: el servidor rechazó el cambio.`;
}

/** Error para relanzar desde un repositorio conservando el código de Postgres que la clasificación necesita. */
export function errorDeSupabase(error: { message: string; code?: string }): Error {
  return Object.assign(new Error(error.message), { code: error.code });
}
