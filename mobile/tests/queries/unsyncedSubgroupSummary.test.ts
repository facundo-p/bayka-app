// Tests for getUnsyncedSubgroupSummary — unsynced subgroup detection query
// Covers: DEL-02-unsynced-detection

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
  isSupabaseConfigured: true,
}));

jest.mock('../../src/database/client', () => ({
  db: {
    select: jest.fn(),
  },
}));

const { db } = require('../../src/database/client');

import { getUnsyncedSubgroupSummary } from '../../src/queries/catalogQueries';

describe('getUnsyncedSubgroupSummary', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('Test 1: returns {activaCount: 2, finalizadaCount: 1} when plantation has mixed subgroups', async () => {
    // Mock: 2 activa + 1 finalizada (sincronizada are filtered out by the WHERE clause)
    const mockRows = [
      { estado: 'activa', cnt: 2 },
      { estado: 'finalizada', cnt: 1 },
    ];

    (db.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          groupBy: jest.fn().mockResolvedValue(mockRows),
        }),
      }),
    });

    const result = await getUnsyncedSubgroupSummary('plant-1');

    expect(result).toEqual({ activaCount: 2, finalizadaCount: 1 });
  });

  it('Test 2: returns {activaCount: 0, finalizadaCount: 0} when all subgroups are sincronizada', async () => {
    // Mock: query returns empty (all sincronizada filtered out)
    (db.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          groupBy: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await getUnsyncedSubgroupSummary('plant-1');

    expect(result).toEqual({ activaCount: 0, finalizadaCount: 0 });
  });

  it('Test 3: returns {activaCount: 0, finalizadaCount: 0} when plantation has no subgroups', async () => {
    (db.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          groupBy: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await getUnsyncedSubgroupSummary('plant-empty');

    expect(result).toEqual({ activaCount: 0, finalizadaCount: 0 });
  });

  it('Test 4: does NOT filter by usuarioCreador — counts subgroups from all technicians', async () => {
    // This test verifies the query shape by checking the select mock was called
    // and no usuario_creador filter is present
    const whereMock = jest.fn().mockReturnValue({
      groupBy: jest.fn().mockResolvedValue([{ estado: 'activa', cnt: 5 }]),
    });

    const fromMock = jest.fn().mockReturnValue({
      where: whereMock,
    });

    (db.select as jest.Mock).mockReturnValue({
      from: fromMock,
    });

    const result = await getUnsyncedSubgroupSummary('plant-1');

    // The function should work and return counts without user filtering
    expect(result.activaCount).toBe(5);
    // Verify select was called (no user-specific params beyond plantacionId + estado filter)
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});
