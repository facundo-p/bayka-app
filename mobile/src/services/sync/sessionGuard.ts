import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { supabase } from '../../supabase/client';
import { esTimeout } from '../../supabase/fetchConTimeout';
import { readCachedUserId } from '../../supabase/auth';

/**
 * Thrown by ensureServerSession when there is no Supabase session capable of
 * authenticating server writes. Callers MUST abort the sync before pushing:
 * without a valid bearer token the REST requests run as the `anon` role and RLS
 * rejects them with a misleading "permission" error (postgres 42501).
 */
const NOMBRE_SESION_EXPIRADA = 'SessionExpiredError';

export class SessionExpiredError extends Error {
  constructor() {
    super('SESSION_EXPIRED');
    this.name = NOMBRE_SESION_EXPIRADA;
  }
}

/** Por nombre y no por instanceof: los tests mockean el módulo y la clase deja de ser la misma. */
export function esSesionExpirada(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === NOMBRE_SESION_EXPIRADA;
}

const NOMBRE_SIN_SESION_DEL_SERVIDOR = 'SinSesionDelServidorError';

/** Una acción que el usuario dispara a mano y solo puede hacerse contra el servidor, sin sesión (#658). */
export class SinSesionDelServidorError extends Error {
  constructor(accion: string) {
    super(`Iniciá sesión con conexión para ${accion}.`);
    this.name = NOMBRE_SIN_SESION_DEL_SERVIDOR;
  }
}

export function esSinSesionDelServidor(err: unknown): err is SinSesionDelServidorError {
  return (err as { name?: string } | null)?.name === NOMBRE_SIN_SESION_DEL_SERVIDOR;
}

/** ensureServerSession para acciones del usuario: sin sesión lanza el motivo listo para mostrar. */
export async function exigirSesionDelServidor(accion: string): Promise<void> {
  try {
    await ensureServerSession();
  } catch (e) {
    throw esSesionExpirada(e) ? new SinSesionDelServidorError(accion) : e;
  }
}

/** Refresh if the access token expires within this window (clock-skew margin). */
const EXPIRY_MARGIN_MS = 30_000;

type SesionDelSdk = { expires_at?: number; user?: { id?: string } };

/** Una sesión del SDK de otra cuenta que la logueada en la app subiría todo con la identidad ajena (#658). */
async function esDeOtraCuenta(session: SesionDelSdk): Promise<boolean> {
  return session.user?.id !== (await readCachedUserId());
}

function esFallaDeRed(error: unknown): boolean {
  return esTimeout(error) || isAuthRetryableFetchError(error);
}

/**
 * Ensures the Supabase SDK holds a usable session before a sync push.
 *
 * The client runs with `autoRefreshToken: false` (see supabase/client), and a
 * user logged in via the offline path has no live SDK session at all — so an
 * expired/absent access token never recovers on its own and writes silently go
 * out as `anon`. This guard validates the session and attempts a single refresh;
 * if no usable session results, it throws SessionExpiredError so the caller can
 * surface a clear "re-login" message instead of a permission error. A session
 * that belongs to another account than the app's user also throws.
 */
export async function ensureServerSession(): Promise<void> {
  const current = await supabase.auth.getSession();
  const session: SesionDelSdk | null = current?.data?.session ?? null;

  if (session) {
    if (await esDeOtraCuenta(session)) throw new SessionExpiredError();
    const expiresAt = session.expires_at;
    // No expiry info → trust it; otherwise refresh only when near/after expiry.
    if (!expiresAt || expiresAt * 1000 > Date.now() + EXPIRY_MARGIN_MS) return;
  }

  const refreshed = await supabase.auth.refreshSession();
  // Un timeout o una falla de red no dicen NADA sobre la sesión: la request nunca
  // llegó. Reportarla como vencida manda al técnico a re-loguearse sin motivo, y
  // justo cuando está sin señal (#451, #668).
  if (refreshed?.error && esFallaDeRed(refreshed.error)) throw refreshed.error;
  if (refreshed?.error || !refreshed?.data?.session || (await esDeOtraCuenta(refreshed.data.session))) {
    throw new SessionExpiredError();
  }
}
