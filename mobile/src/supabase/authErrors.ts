/**
 * Maps Supabase auth errors to user-friendly Spanish messages — field technicians
 * must never see raw SDK strings (e.g. a down backend returns non-JSON 5xx and
 * `error.message` becomes a JSON parse error, not "bad credentials"). Pure functions,
 * unit-testable without rendering UI.
 */

export const AUTH_ERROR = {
  credencialesInvalidas: 'invalid_credentials',
  conectividad: 'connectivity',
  cuentaDesactivada: 'account_disabled',
  desconocido: 'unknown',
} as const;
export type AuthErrorKind = (typeof AUTH_ERROR)[keyof typeof AUTH_ERROR];

export const AUTH_REJECTION = {
  /** Login aceptado por Supabase pero sin fila en `profiles`: nadie le asignó un rol. */
  sinPerfil: 'no_profile',
} as const;
type AuthRejectionKind = (typeof AUTH_REJECTION)[keyof typeof AUTH_REJECTION];

export const AUTH_MESSAGES: Record<AuthErrorKind | AuthRejectionKind, string> = {
  [AUTH_ERROR.credencialesInvalidas]: 'Email o contraseña incorrectos.',
  [AUTH_ERROR.conectividad]: 'No se pudo conectar con el servidor. Verificá tu conexión o intentá más tarde.',
  [AUTH_ERROR.cuentaDesactivada]: 'Tu cuenta fue desactivada. Contactá a un administrador.',
  [AUTH_ERROR.desconocido]: 'No se pudo iniciar sesión. Intentá nuevamente.',
  [AUTH_REJECTION.sinPerfil]: 'Tu cuenta no tiene un perfil asignado. Contactá a un administrador.',
};

export type AnyAuthError =
  | { message?: string; status?: number; code?: string; name?: string }
  | null
  | undefined;

// A backend that is down/unreachable produces these instead of clean JSON.
const CONNECTIVITY_MESSAGE_PATTERNS = [
  'json parse error',
  'unexpected character',
  'unexpected token',
  'network request failed',
  'failed to fetch',
  'fetch failed',
  'timeout',
  'timed out',
];

// supabase-js wraps transient network failures in these error names.
const CONNECTIVITY_ERROR_NAMES = ['authretryablefetcherror', 'typeerror'];

/** Classify an auth error into an actionable category. */
export function classifyAuthError(error: AnyAuthError): AuthErrorKind {
  if (!error) return AUTH_ERROR.desconocido;

  const status = typeof error.status === 'number' ? error.status : undefined;
  const code = (error.code ?? '').toLowerCase();
  const name = (error.name ?? '').toLowerCase();
  const message = (error.message ?? '').toLowerCase();

  // Supabase returns 400 + this code for real invalid credentials; check first so
  // it's never misread as connectivity.
  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return AUTH_ERROR.credencialesInvalidas;
  }

  // Usuario baneado (baja reversible desde la web de gestión).
  if (code === 'user_banned' || message.includes('banned')) {
    return AUTH_ERROR.cuentaDesactivada;
  }

  // Server down / unreachable / non-JSON response / timeout → connectivity.
  if (status !== undefined && status >= 500) return AUTH_ERROR.conectividad;
  if (CONNECTIVITY_ERROR_NAMES.includes(name)) return AUTH_ERROR.conectividad;
  if (CONNECTIVITY_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern))) {
    return AUTH_ERROR.conectividad;
  }

  return AUTH_ERROR.desconocido;
}

/** Server caído, inalcanzable o con respuesta no-JSON: no dice nada sobre las credenciales. */
export function esErrorDeConectividad(error: AnyAuthError): boolean {
  return classifyAuthError(error) === AUTH_ERROR.conectividad;
}

export function esErrorDeCuentaDesactivada(error: AnyAuthError): boolean {
  return classifyAuthError(error) === AUTH_ERROR.cuentaDesactivada;
}

/** User-facing message for an auth error. Never returns a raw SDK message. */
export function authErrorMessage(error: AnyAuthError): string {
  return AUTH_MESSAGES[classifyAuthError(error)];
}
