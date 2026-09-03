// countPendingTreePhotos: el conteo global (sin plantacionId) debe ejecutar la
// query real, no devolver 0 hardcodeado como antes (#71).

jest.mock('../../src/database/client', () => ({
  db: {
    select: jest.fn(),
  },
}));

const { db } = require('../../src/database/client');

import {
  countPendingTreePhotos,
  countPendingParcelas,
  countPendingGroupsByPlantation,
  countPendingParcelasByPlantation,
  countPendingTreePhotosByPlantation,
} from '../../src/queries/pendingSyncQueries';

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

describe('variantes agrupadas por plantación (dot por tarjeta)', () => {
  function mockGroupByChain(rows: Array<{ plantacionId: string; cnt: number }>) {
    const groupBy = jest.fn().mockResolvedValue(rows);
    const where = jest.fn().mockReturnValue({ groupBy });
    const innerJoin = jest.fn().mockReturnValue({ where });
    const from = jest.fn().mockReturnValue({ innerJoin, where });
    (db.select as jest.Mock).mockReturnValue({ from });
  }

  test('countPendingGroupsByPlantation devuelve filas por plantación', async () => {
    mockGroupByChain([{ plantacionId: 'p1', cnt: 2 }]);
    const result = await countPendingGroupsByPlantation('user-1');
    expect(result).toEqual([{ plantacionId: 'p1', cnt: 2 }]);
  });

  test('countPendingParcelasByPlantation devuelve filas por plantación', async () => {
    mockGroupByChain([{ plantacionId: 'p2', cnt: 1 }]);
    const result = await countPendingParcelasByPlantation();
    expect(result).toEqual([{ plantacionId: 'p2', cnt: 1 }]);
  });

  test('countPendingTreePhotosByPlantation devuelve filas por plantación', async () => {
    mockGroupByChain([{ plantacionId: 'p3', cnt: 5 }]);
    const result = await countPendingTreePhotosByPlantation();
    expect(result).toEqual([{ plantacionId: 'p3', cnt: 5 }]);
  });
});
