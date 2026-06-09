// Issue #59 — getGroupParcelaCodigo resuelve el código de parcela que se usa
// como primer segmento del SubID. La ausencia de parcela NO es soportada: se
// notifica como error (throw) para corregir los datos (feedback PR #79).

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

  // Grupo legacy sin parcela (estado que el sync admite): notifica + degrada a ''
  // en vez de tirar, para no romper el registro de árboles en el campo (PR #79).
  it('devuelve "" y notifica cuando el grupo no tiene parcela', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    selectQueue = [[{ parcelaId: null }]];
    expect(await getGroupParcelaCodigo('grupo-1')).toBe('');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('devuelve "" cuando el grupo no existe', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    selectQueue = [[]];
    expect(await getGroupParcelaCodigo('inexistente')).toBe('');
    (console.error as jest.Mock).mockRestore();
  });

  it('devuelve "" cuando la parcela referida no existe', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    selectQueue = [[{ parcelaId: 'parcela-x' }], []];
    expect(await getGroupParcelaCodigo('grupo-1')).toBe('');
    (console.error as jest.Mock).mockRestore();
  });
});
