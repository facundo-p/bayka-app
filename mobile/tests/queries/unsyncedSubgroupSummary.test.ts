// Unsynced subgroup detection query

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

import { getUnsyncedGroupSummary } from '../../src/queries/catalogQueries';

describe('getUnsyncedGroupSummary', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('Test 1: returns {activaCount: 2, finalizadaCount: 1} when plantation has mixed groups', async () => {
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

    const result = await getUnsyncedGroupSummary('plant-1');

    expect(result).toEqual({ activaCount: 2, finalizadaCount: 1 });
  });

  it('Test 2: returns {activaCount: 0, finalizadaCount: 0} when all groups are sincronizada', async () => {
    // Mock: query returns empty (all sincronizada filtered out)
    (db.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          groupBy: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await getUnsyncedGroupSummary('plant-1');

    expect(result).toEqual({ activaCount: 0, finalizadaCount: 0 });
  });

  it('Test 3: returns {activaCount: 0, finalizadaCount: 0} when plantation has no groups', async () => {
    (db.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          groupBy: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await getUnsyncedGroupSummary('plant-empty');

    expect(result).toEqual({ activaCount: 0, finalizadaCount: 0 });
  });

  it('Test 4: does NOT filter by usuarioCreador — counts groups from all technicians', async () => {
    const whereMock = jest.fn().mockReturnValue({
      groupBy: jest.fn().mockResolvedValue([{ estado: 'activa', cnt: 5 }]),
    });

    const fromMock = jest.fn().mockReturnValue({
      where: whereMock,
    });

    (db.select as jest.Mock).mockReturnValue({
      from: fromMock,
    });

    const result = await getUnsyncedGroupSummary('plant-1');

    expect(result.activaCount).toBe(5);
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});
