/**
 * Maps Supabase auth errors to user-friendly Spanish messages.
 *
 * The app is used by field technicians, not developers, so the UI must never
 * surface raw SDK strings. The most common offender: a down/paused backend
 * returns a non-JSON (HTML/text) 5xx, and supabase-js reports
 * `error.message = "JSON Parse error: Unexpected character e"`. That is a
 * connectivity problem, not bad credentials.
 *
 * `classifyAuthError` is pure so it can be unit-tested without rendering UI.
 */

export type AuthErrorKind = 'invalid_credentials' | 'connectivity' | 'unknown';

export const AUTH_MESSAGES: Record<AuthErrorKind, string> = {
  invalid_credentials: 'Email o contraseña incorrectos.',
  connectivity: 'No se pudo conectar con el servidor. Verificá tu conexión o intentá más tarde.',
  unknown: 'No se pudo iniciar sesión. Intentá nuevamente.',
};

type AnyAuthError =
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
  if (!error) return 'unknown';

  const status = typeof error.status === 'number' ? error.status : undefined;
  const code = (error.code ?? '').toLowerCase();
  const name = (error.name ?? '').toLowerCase();
  const message = (error.message ?? '').toLowerCase();

  // Real invalid credentials: Supabase returns 400 + this code. Check first so
  // a precise credential error is never misread as connectivity.
  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'invalid_credentials';
  }

  // Server down / unreachable / non-JSON response / timeout → connectivity.
  if (status !== undefined && status >= 500) return 'connectivity';
  if (CONNECTIVITY_ERROR_NAMES.includes(name)) return 'connectivity';
  if (CONNECTIVITY_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern))) {
    return 'connectivity';
  }

  return 'unknown';
}

/** User-facing message for an auth error. Never returns a raw SDK message. */
export function authErrorMessage(error: AnyAuthError): string {
  return AUTH_MESSAGES[classifyAuthError(error)];
}
