/**
 * Tests de pendingSyncQueries — foco en countPendingTreePhotos (issue #71):
 * el conteo global (sin plantacionId) debe ejecutar la query real, no
 * devolver 0 hardcodeado como antes.
 */

jest.mock('../../src/database/client', () => ({
  db: {
    select: jest.fn(),
  },
}));

const { db } = require('../../src/database/client');

import { countPendingTreePhotos, countPendingParcelas } from '../../src/queries/pendingSyncQueries';

function mockJoinChain(rows: { cnt: number }[]) {
  const where = jest.fn().mockResolvedValue(rows);
  const innerJoin = jest.fn().mockReturnValue({ where });
  const from = jest.fn().mockReturnValue({ innerJoin });
  (db.select as jest.Mock).mockReturnValue({ from });
  return { where, innerJoin, from };
}

function mockWhereChain(rows: { cnt: number }[]) {
  const where = jest.fn().mockResolvedValue(rows);
  const from = jest.fn().mockReturnValue({ where });
  (db.select as jest.Mock).mockReturnValue({ from });
  return { where, from };
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('countPendingTreePhotos', () => {
  test('sin plantacionId ejecuta la query global (no devuelve 0 hardcodeado)', async () => {
    mockJoinChain([{ cnt: 7 }]);

    const result = await countPendingTreePhotos({});

    expect(db.select).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ cnt: 7 }]);
  });

  test('con plantacionId también ejecuta la query (filtrada)', async () => {
    mockJoinChain([{ cnt: 2 }]);

    const result = await countPendingTreePhotos({ plantacionId: 'plant-1' });

    expect(db.select).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ cnt: 2 }]);
  });
});

describe('countPendingParcelas', () => {
  test('cuenta global sin plantacionId', async () => {
    mockWhereChain([{ cnt: 3 }]);

    const result = await countPendingParcelas({});

    expect(db.select).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ cnt: 3 }]);
  });
});
