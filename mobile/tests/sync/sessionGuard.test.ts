// Tests for ensureServerSession — the pre-push guard that prevents anon writes
// (which RLS rejects as a misleading permission error) when the SDK session is
// expired or absent.

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      refreshSession: jest.fn(),
    },
  },
  isSupabaseConfigured: true,
}));

jest.mock('../../src/supabase/auth', () => ({ readCachedUserId: jest.fn() }));

const { supabase } = require('../../src/supabase/client');
const { readCachedUserId } = require('../../src/supabase/auth');
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { ensureServerSession, exigirSesionDelServidor, SessionExpiredError } from '../../src/services/sync/sessionGuard';
import { esTimeout, MARCA_DE_TIMEOUT } from '../../src/supabase/fetchConTimeout';

const getSession = supabase.auth.getSession as jest.Mock;
const refreshSession = supabase.auth.refreshSession as jest.Mock;

const FUTURE = Math.floor(Date.now() / 1000) + 3600; // +1h
const PAST = Math.floor(Date.now() / 1000) - 3600; // -1h
const USUARIO = { id: 'user-a' };

beforeEach(() => (readCachedUserId as jest.Mock).mockResolvedValue(USUARIO.id));

describe('ensureServerSession', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes without refreshing when the session is valid (future expiry)', async () => {
    getSession.mockResolvedValue({ data: { session: { expires_at: FUTURE, user: USUARIO } } });

    await expect(ensureServerSession()).resolves.toBeUndefined();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('passes for a session without expiry info (does not force a refresh)', async () => {
    getSession.mockResolvedValue({ data: { session: { user: USUARIO } } });

    await expect(ensureServerSession()).resolves.toBeUndefined();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('throws SessionExpiredError when there is no session and refresh fails', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: 'Auth session missing' } });

    await expect(ensureServerSession()).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it('recovers (no throw) when an expired session refreshes successfully', async () => {
    getSession.mockResolvedValue({ data: { session: { expires_at: PAST, user: USUARIO } } });
    refreshSession.mockResolvedValue({ data: { session: { expires_at: FUTURE, user: USUARIO } }, error: null });

    await expect(ensureServerSession()).resolves.toBeUndefined();
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('throws when an expired session cannot be refreshed', async () => {
    getSession.mockResolvedValue({ data: { session: { expires_at: PAST, user: USUARIO } } });
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: 'refresh_token_not_found' } });

    await expect(ensureServerSession()).rejects.toBeInstanceOf(SessionExpiredError);
  });
});

/** Celular compartido: la app está logueada como B y el SDK tiene la sesión de A (#658). */
describe('ensureServerSession — sesión de otra cuenta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (readCachedUserId as jest.Mock).mockResolvedValue('user-b');
  });

  it('rechaza una sesión válida de otra cuenta sin intentar refrescarla', async () => {
    getSession.mockResolvedValue({ data: { session: { expires_at: FUTURE, user: USUARIO } } });

    await expect(ensureServerSession()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('rechaza un refresh que devuelve la sesión de otra cuenta', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    refreshSession.mockResolvedValue({ data: { session: { expires_at: FUTURE, user: USUARIO } }, error: null });

    await expect(ensureServerSession()).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it('rechaza la sesión si no hay usuario cacheado', async () => {
    (readCachedUserId as jest.Mock).mockResolvedValue(null);
    getSession.mockResolvedValue({ data: { session: { expires_at: FUTURE, user: USUARIO } } });

    await expect(ensureServerSession()).rejects.toBeInstanceOf(SessionExpiredError);
  });
});

/**
 * `refreshSession` es el primer candidato a colgarse en el campo. Reportar ese
 * timeout como sesión vencida manda al técnico a re-loguearse sin motivo, y justo
 * cuando no tiene señal para hacerlo (#451).
 */
describe('ensureServerSession — timeout vs sesión vencida', () => {
  beforeEach(() => jest.clearAllMocks());

  it('un timeout en el refresh NO se reporta como sesión vencida', async () => {
    getSession.mockResolvedValue({ data: { session: { expires_at: PAST, user: USUARIO } } });
    refreshSession.mockResolvedValue({
      error: { message: `AuthRetryableFetchError: ${MARCA_DE_TIMEOUT}: sin respuesta en 30000ms — /auth/v1/token` },
      data: { session: null },
    });

    const fallo = await ensureServerSession().catch((e) => e);

    expect(fallo).not.toBeInstanceOf(SessionExpiredError);
    expect(esTimeout(fallo)).toBe(true);
  });

  it('un error que no es timeout sigue siendo sesión vencida', async () => {
    getSession.mockResolvedValue({ data: { session: { expires_at: PAST, user: USUARIO } } });
    refreshSession.mockResolvedValue({ error: { message: 'Invalid Refresh Token' }, data: { session: null } });

    await expect(ensureServerSession()).rejects.toBeInstanceOf(SessionExpiredError);
  });
});

/** Una falla de red en el refresh no es una sesión vencida: no se pide re-login (#668). */
describe('ensureServerSession — falla de red en el refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: { expires_at: PAST, user: USUARIO } } });
  });

  it('un AuthRetryableFetchError se relanza tal cual, sin SessionExpiredError', async () => {
    const red = new AuthRetryableFetchError('Network request failed', 0);
    refreshSession.mockResolvedValue({ error: red, data: { session: null } });

    const fallo = await ensureServerSession().catch((e) => e);

    expect(fallo).toBe(red);
    expect(fallo).not.toBeInstanceOf(SessionExpiredError);
  });

  it('exigirSesionDelServidor no lo convierte en "Iniciá sesión…"', async () => {
    refreshSession.mockResolvedValue({ error: new AuthRetryableFetchError('Network request failed', 0), data: { session: null } });

    const fallo = await exigirSesionDelServidor('finalizar la plantación').catch((e) => e);

    expect(fallo.message).toBe('Network request failed');
  });

  it('un rechazo del server (AuthApiError) sigue siendo sesión vencida', async () => {
    refreshSession.mockResolvedValue({ error: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found'), data: { session: null } });

    await expect(exigirSesionDelServidor('finalizar la plantación'))
      .rejects.toThrow('Iniciá sesión con conexión para finalizar la plantación.');
  });
});
