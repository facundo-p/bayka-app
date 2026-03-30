// Tests for freshnessQueries
// Validates local MAX(created_at), server freshness check, and 30s cooldown

let mockDbResult: any = null;

jest.mock('../../src/database/client', () => {
  const makeChain = (): any => new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') {
        const result = mockDbResult;
        return (resolve: any) => Promise.resolve(result).then(resolve);
      }
      if (prop === Symbol.iterator) return undefined;
      return jest.fn().mockReturnValue(makeChain());
    }
  });

  return {
    db: {
      select: jest.fn().mockImplementation(() => makeChain()),
    },
    __setPendingDbResult: (val: any) => { mockDbResult = val; },
  };
});

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { __setPendingDbResult: setPendingDbResult } = require('../../src/database/client');
const { supabase } = require('../../src/supabase/client');

import {
  getLocalMaxSubgroupCreatedAt,
  checkFreshness,
  _resetCooldown,
} from '../../src/queries/freshnessQueries';

function makeSupabaseChain(returnVal: any) {
  return {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(returnVal),
  };
}

describe('freshnessQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDbResult = null;
    _resetCooldown();
  });

  describe('getLocalMaxSubgroupCreatedAt', () => {
    it('returns MAX(created_at) from local subgroups table', async () => {
      setPendingDbResult([{ maxCreatedAt: '2026-03-20T10:00:00Z' }]);
      const result = await getLocalMaxSubgroupCreatedAt();
      expect(result).toBe('2026-03-20T10:00:00Z');
    });

    it('returns null when no subgroups exist', async () => {
      setPendingDbResult([{ maxCreatedAt: null }]);
      const result = await getLocalMaxSubgroupCreatedAt();
      expect(result).toBeNull();
    });
  });

  describe('checkFreshness', () => {
    it('returns true when server max timestamp > local max timestamp', async () => {
      setPendingDbResult([{ maxCreatedAt: '2026-03-19T00:00:00Z' }]);
      (supabase.from as jest.Mock).mockReturnValue(
        makeSupabaseChain({
          data: { created_at: '2026-03-20T10:00:00Z' },
          error: null,
        })
      );

      const result = await checkFreshness(['plantation-1']);
      expect(result).toBe(true);
    });

    it('returns false when server max timestamp <= local max timestamp', async () => {
      setPendingDbResult([{ maxCreatedAt: '2026-03-20T12:00:00Z' }]);
      (supabase.from as jest.Mock).mockReturnValue(
        makeSupabaseChain({
          data: { created_at: '2026-03-20T10:00:00Z' },
          error: null,
        })
      );

      const result = await checkFreshness(['plantation-1']);
      expect(result).toBe(false);
    });

    it('returns false when called within 30-second cooldown window', async () => {
      setPendingDbResult([{ maxCreatedAt: '2026-03-19T00:00:00Z' }]);
      (supabase.from as jest.Mock).mockReturnValue(
        makeSupabaseChain({
          data: { created_at: '2026-03-20T10:00:00Z' },
          error: null,
        })
      );

      // First call — passes cooldown
      await checkFreshness(['plantation-1']);

      // Second call within cooldown — should return false immediately
      const result = await checkFreshness(['plantation-1']);
      expect(result).toBe(false);
      // supabase.from should only have been called once (first call)
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });

    it('returns false when server query returns no data (empty plantation)', async () => {
      setPendingDbResult([{ maxCreatedAt: '2026-03-19T00:00:00Z' }]);
      (supabase.from as jest.Mock).mockReturnValue(
        makeSupabaseChain({
          data: null,
          error: null,
        })
      );

      const result = await checkFreshness(['plantation-1']);
      expect(result).toBe(false);
    });

    it('returns false for empty plantacionIds array', async () => {
      const result = await checkFreshness([]);
      expect(result).toBe(false);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('returns false when supabase throws', async () => {
      setPendingDbResult([{ maxCreatedAt: '2026-03-19T00:00:00Z' }]);
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Network error')),
      });

      const result = await checkFreshness(['plantation-1']);
      expect(result).toBe(false);
    });
  });
});
