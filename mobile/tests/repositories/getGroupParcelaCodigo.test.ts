// Issue #59 — getGroupParcelaCodigo resuelve el código de parcela que se usa
// como primer segmento del SubID. Devuelve '' cuando el grupo no tiene parcela.

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

  it('devuelve "" cuando el grupo no tiene parcela (legacy)', async () => {
    selectQueue = [[{ parcelaId: null }]];
    expect(await getGroupParcelaCodigo('grupo-1')).toBe('');
  });

  it('devuelve "" cuando el grupo no existe', async () => {
    selectQueue = [[]];
    expect(await getGroupParcelaCodigo('inexistente')).toBe('');
  });

  it('devuelve "" cuando la parcela referida no existe', async () => {
    selectQueue = [[{ parcelaId: 'parcela-x' }], []];
    expect(await getGroupParcelaCodigo('grupo-1')).toBe('');
  });
});
