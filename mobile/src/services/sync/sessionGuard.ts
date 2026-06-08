import { supabase } from '../../supabase/client';

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

/**
 * Ensures the Supabase SDK holds a usable session before a sync push.
 *
 * The client runs with `autoRefreshToken: false` (see supabase/client), and a
 * user logged in via the offline path has no live SDK session at all — so an
 * expired/absent access token never recovers on its own and writes silently go
 * out as `anon`. This guard validates the session and attempts a single refresh;
 * if no usable session results, it throws SessionExpiredError so the caller can
 * surface a clear "re-login" message instead of a permission error.
 */
export async function ensureServerSession(): Promise<void> {
  const current = await supabase.auth.getSession();
  const session = current?.data?.session ?? null;

  if (session) {
    const expiresAt = (session as { expires_at?: number }).expires_at;
    // No expiry info → trust it; otherwise refresh only when near/after expiry.
    if (!expiresAt || expiresAt * 1000 > Date.now() + EXPIRY_MARGIN_MS) return;
  }

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed?.error || !refreshed?.data?.session) {
    throw new SessionExpiredError();
  }
}
