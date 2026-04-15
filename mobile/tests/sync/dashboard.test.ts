// Tests for dashboardQueries — Plan 03-03
// Covers: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06

jest.mock('../../src/database/schema', () => ({
  plantations: { id: 'plantations.id', createdAt: 'plantations.created_at' },
  plantationUsers: { plantationId: 'pu.plantation_id', userId: 'pu.user_id' },
  subgroups: { id: 'sg.id', plantacionId: 'sg.plantacion_id', estado: 'sg.estado', pendingSync: 'sg.pending_sync' },
  trees: {
    id: 'trees.id',
    subgrupoId: 'trees.subgrupo_id',
    usuarioRegistro: 'trees.usuario_registro',
    createdAt: 'trees.created_at',
    plantacionId: 'trees.plantacion_id',
  },
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
  and: jest.fn((...args: unknown[]) => ({ type: 'and', args })),
  count: jest.fn(() => ({ type: 'count' })),
  desc: jest.fn((col: unknown) => ({ type: 'desc', col })),
  sql: Object.assign(
    jest.fn((...args: unknown[]) => ({ type: 'sql', args })),
    { raw: jest.fn() }
  ),
  getTableColumns: jest.fn((table: unknown) => table),
}));

// db mock — creates a self-referential chain where all intermediate methods return
// the chain itself, and terminal methods (groupBy, orderBy) resolve to empty arrays.
// NOTE: "where" is intermediate (not terminal) because some queries chain .where().groupBy()
jest.mock('../../src/database/client', () => {
  function makeChain(): Record<string, jest.Mock> {
    const c: Record<string, jest.Mock> = {};
    const methods = ['from', 'innerJoin', 'where'];
    methods.forEach((m) => {
      c[m] = jest.fn(() => c);
    });
    // Terminal methods: resolve to empty arrays (query executes here)
    c.groupBy = jest.fn().mockResolvedValue([]);
    c.orderBy = jest.fn().mockResolvedValue([]);
    return c;
  }
  const chain = makeChain();
  return {
    db: {
      select: jest.fn(() => chain),
      _chain: chain,
    },
  };
});

import { db } from '../../src/database/client';
import {
  getPlantationsForRole,
  getUnsyncedTreeCounts,
  getUserTotalTreeCounts,
  getPendingSyncCounts,
  getTodayTreeCounts,
  getTotalTreeCounts,
} from '../../src/queries/dashboardQueries';
import { eq } from 'drizzle-orm';

// Access the internal chain from the mocked module
const mockDb = db as unknown as { select: jest.Mock; _chain: Record<string, jest.Mock> };

function getChain(): Record<string, jest.Mock> {
  return mockDb._chain;
}

describe('dashboardQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-establish chainability after clearAllMocks (which clears all mock implementations)
    const c = getChain();
    const intermediates = ['from', 'innerJoin', 'where'];
    intermediates.forEach((m) => {
      if (c[m]) c[m].mockReturnValue(c);
    });
    // Terminal methods resolve to empty arrays
    c.groupBy.mockResolvedValue([]);
    c.orderBy.mockResolvedValue([]);
    // db.select returns the chain
    mockDb.select.mockReturnValue(c);
  });

  describe('DASH-01: getPlantationsForRole — tecnico sees only assigned plantations', () => {
    it('uses innerJoin with plantationUsers when isAdmin=false', async () => {
      await getPlantationsForRole(false, 'user-123');

      // Must call innerJoin (to join with plantation_users)
      expect(getChain().innerJoin).toHaveBeenCalled();

      // Must filter by userId
      expect(eq).toHaveBeenCalledWith(
        expect.anything(),
        'user-123'
      );
    });

    it('returns empty array when userId is null and isAdmin=false', async () => {
      const result = await getPlantationsForRole(false, null);
      expect(result).toEqual([]);
    });
  });

  describe('DASH-02: getPlantationsForRole — admin sees all plantations', () => {
    it('does NOT call innerJoin when isAdmin=true', async () => {
      await getPlantationsForRole(true, 'admin-user');

      expect(getChain().innerJoin).not.toHaveBeenCalled();
    });

    it('orders by createdAt descending', async () => {
      await getPlantationsForRole(true, 'admin-user');
      expect(getChain().orderBy).toHaveBeenCalled();
    });
  });

  describe('DASH-03: getTotalTreeCounts — total trees per plantation', () => {
    it('selects tree count grouped by plantacionId', async () => {
      await getTotalTreeCounts();

      expect(mockDb.select).toHaveBeenCalled();
      expect(getChain().from).toHaveBeenCalled();
      expect(getChain().groupBy).toHaveBeenCalled();
    });
  });

  describe('DASH-04: getUnsyncedTreeCounts — unsynced trees per plantation', () => {
    it('filters by pendingSync=true AND usuarioRegistro = userId', async () => {
      await getUnsyncedTreeCounts('user-123');

      // Must filter by userId
      expect(eq).toHaveBeenCalledWith(
        expect.anything(),
        'user-123'
      );
      // Must use where clause (pendingSync + userId)
      expect(getChain().where).toHaveBeenCalled();
    });

    it('returns empty array when userId is null', async () => {
      const result = await getUnsyncedTreeCounts(null);
      expect(result).toEqual([]);
    });
  });

  describe('DASH-05: getUserTotalTreeCounts — user total trees per plantation', () => {
    it('filters only by usuarioRegistro = userId (no estado filter)', async () => {
      await getUserTotalTreeCounts('user-123');

      expect(eq).toHaveBeenCalledWith(
        expect.anything(),
        'user-123'
      );
    });

    it('returns empty array when userId is null', async () => {
      const result = await getUserTotalTreeCounts(null);
      expect(result).toEqual([]);
    });
  });

  describe('DASH-06: getTodayTreeCounts — trees registered today', () => {
    it('filters by usuarioRegistro = userId and uses where clause for date', async () => {
      await getTodayTreeCounts('user-123');

      expect(eq).toHaveBeenCalledWith(
        expect.anything(),
        'user-123'
      );
      // Must use a where clause (composite condition with sql date filter)
      expect(getChain().where).toHaveBeenCalled();
    });

    it('returns empty array when userId is null', async () => {
      const result = await getTodayTreeCounts(null);
      expect(result).toEqual([]);
    });
  });

  describe('getPendingSyncCounts — pending sync per plantation (SYNC-07)', () => {
    it('filters subgroups where pendingSync=true and groups by plantation', async () => {
      await getPendingSyncCounts();

      expect(eq).toHaveBeenCalledWith(
        expect.anything(),
        true
      );
      expect(getChain().groupBy).toHaveBeenCalled();
    });
  });
});
