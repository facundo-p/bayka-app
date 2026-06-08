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

const { supabase } = require('../../src/supabase/client');
import { ensureServerSession, SessionExpiredError } from '../../src/services/sync/sessionGuard';

const getSession = supabase.auth.getSession as jest.Mock;
const refreshSession = supabase.auth.refreshSession as jest.Mock;

const FUTURE = Math.floor(Date.now() / 1000) + 3600; // +1h
const PAST = Math.floor(Date.now() / 1000) - 3600; // -1h

describe('ensureServerSession', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes without refreshing when the session is valid (future expiry)', async () => {
    getSession.mockResolvedValue({ data: { session: { expires_at: FUTURE } } });

    await expect(ensureServerSession()).resolves.toBeUndefined();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('passes for a session without expiry info (does not force a refresh)', async () => {
    getSession.mockResolvedValue({ data: { session: {} } });

    await expect(ensureServerSession()).resolves.toBeUndefined();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('throws SessionExpiredError when there is no session and refresh fails', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: 'Auth session missing' } });

    await expect(ensureServerSession()).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it('recovers (no throw) when an expired session refreshes successfully', async () => {
    getSession.mockResolvedValue({ data: { session: { expires_at: PAST } } });
    refreshSession.mockResolvedValue({ data: { session: { expires_at: FUTURE } }, error: null });

    await expect(ensureServerSession()).resolves.toBeUndefined();
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('throws when an expired session cannot be refreshed', async () => {
    getSession.mockResolvedValue({ data: { session: { expires_at: PAST } } });
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: 'refresh_token_not_found' } });

    await expect(ensureServerSession()).rejects.toBeInstanceOf(SessionExpiredError);
  });
});
