import { supabase } from '../../supabase/client';
import { esTimeout } from '../../supabase/fetchConTimeout';
import { readCachedUserId } from '../../supabase/auth';

/**
 * Thrown by ensureServerSession when there is no Supabase session capable of
 * authenticating server writes. Callers MUST abort the sync before pushing:
 * without a valid bearer token the REST requests run as the `anon` role and RLS
 * rejects them with a misleading "permission" error (postgres 42501).
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}

/** Refresh if the access token expires within this window (clock-skew margin). */
const EXPIRY_MARGIN_MS = 30_000;

type SesionDelSdk = { expires_at?: number; user?: { id?: string } };

/** Una sesión del SDK de otra cuenta que la logueada en la app subiría todo con la identidad ajena (#658). */
async function esDeOtraCuenta(session: SesionDelSdk): Promise<boolean> {
  return session.user?.id !== (await readCachedUserId());
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
  // Un timeout no dice NADA sobre la sesión: la request nunca llegó. Reportarlo
  // como vencida manda al técnico a re-loguearse sin motivo, y justo cuando está
  // sin señal (#451).
  if (refreshed?.error && esTimeout(refreshed.error)) throw refreshed.error;
  if (refreshed?.error || !refreshed?.data?.session || (await esDeOtraCuenta(refreshed.data.session))) {
    throw new SessionExpiredError();
  }
}
