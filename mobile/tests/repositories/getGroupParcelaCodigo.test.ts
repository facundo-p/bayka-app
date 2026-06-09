// Issue #59 — getGroupParcelaCodigo resuelve el código de parcela (primer
// segmento del SubID). Todo grupo tiene parcela con código: la ausencia es un
// dato inválido y se lanza error, no se degrada a '' (feedback PR #79).

let selectQueue: any[][];

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockDb;
  },
}));

let mockDb: any;

beforeEach(() => {
  selectQueue = [];
  mockDb = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
      })),
    })),
  };
});

import { getGroupParcelaCodigo } from '../../src/repositories/GroupRepository';

describe('getGroupParcelaCodigo', () => {
  it('devuelve el codigo de la parcela cuando el grupo tiene parcelaId', async () => {
    selectQueue = [[{ parcelaId: 'parcela-1' }], [{ codigo: 'AL' }]];
    expect(await getGroupParcelaCodigo('grupo-1')).toBe('AL');
  });

  it('lanza error cuando el grupo no tiene parcela', async () => {
    selectQueue = [[{ parcelaId: null }]];
    await expect(getGroupParcelaCodigo('grupo-1')).rejects.toThrow(/sin parcela/);
  });

  it('lanza error cuando el grupo no existe', async () => {
    selectQueue = [[]];
    await expect(getGroupParcelaCodigo('inexistente')).rejects.toThrow(/sin parcela/);
  });

  it('lanza error cuando la parcela referida no existe', async () => {
    selectQueue = [[{ parcelaId: 'parcela-x' }], []];
    await expect(getGroupParcelaCodigo('grupo-1')).rejects.toThrow(/sin código/);
  });
});
