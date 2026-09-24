// Unit tests for TreeRepository (mock-based)

// --- DB mock infrastructure ---

let mockInsertValues: jest.Mock;
let mockDeleteWhere: jest.Mock;
let mockUpdateWhere: jest.Mock;

jest.mock('../../src/database/client', () => {
  return {
    get db() {
      return mockDb;
    },
  };
});

// `enTransaccion` reemplaza a `db.transaction`, que con callbacks async commitea
// vacío (#448). Passthrough con `db`, que es lo que pasa el helper real.
jest.mock('../../src/database/transaccion', () => ({
  enTransaccion: jest.fn((cb: (tx: unknown) => Promise<unknown>) =>
    cb(jest.requireMock('../../src/database/client').db)),
}));


jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/services/PhotoService', () => ({
  borrarFotosLocales: jest.fn(),
}));

let mockDb: any;

beforeAll(() => {
  mockInsertValues = jest.fn().mockResolvedValue(undefined);
  mockDeleteWhere = jest.fn().mockResolvedValue(undefined);
  mockUpdateWhere = jest.fn().mockResolvedValue(undefined);

  mockDb = buildMockDb([]);
});

function buildMockDb(selectResults: any[]) {
  return {
    // `registrarBorrado` encadena `.onConflictDoUpdate()` (#467).
    insert: jest.fn(() => ({
      values: jest.fn((valores: unknown) => {
        mockInsertValues(valores);
        return { onConflictDoUpdate: jest.fn().mockResolvedValue(undefined) };
      }),
    })),
    delete: jest.fn(() => ({ where: mockDeleteWhere })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: mockUpdateWhere })),
    })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve(selectResults)),
        orderBy: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve(selectResults)),
        })),
        leftJoin: jest.fn(() => ({
          where: jest.fn(() => ({ orderBy: jest.fn(() => Promise.resolve(selectResults)) })),
        })),
      })),
    })),
    transaction: jest.fn(async (fn: (tx: any) => Promise<void>) => {
      const tx = {
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve(selectResults)),
          })),
        })),
        update: jest.fn(() => ({
          set: jest.fn(() => ({ where: mockUpdateWhere })),
        })),
      };
      await fn(tx);
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInsertValues = jest.fn().mockResolvedValue(undefined);
  mockDeleteWhere = jest.fn().mockResolvedValue(undefined);
  mockUpdateWhere = jest.fn().mockResolvedValue(undefined);
});

import {
  insertTree,
  deleteLastTree,
  reverseTreeOrder,
  resolveNNTree,
  updateTreePhoto,
  deleteTreeAndRecalculate,
} from '../../src/repositories/TreeRepository';
import { enTransaccion } from '../../src/database/transaccion';
import { ENTIDAD_BORRADA } from '../../src/constants/entidadBorrada';
import { borrarFotosLocales } from '../../src/services/PhotoService';

const mockBorrarFotos = borrarFotosLocales as jest.Mock;
const FOTO_VIEJA = 'file://document/photos/photo_1.jpg';
const FOTO_NUEVA = 'file://document/photos/photo_2.jpg';

describe('TreeRepository', () => {
  describe('insertTree', () => {
    it('first tree in subgroup gets posicion=1 when MAX returns null', async () => {
      // La fila del mock también sirve al lookup de parcela (parcelaId + codigo 'PC').
      mockDb = buildMockDb([{ maxPos: null, parcelaId: 'p1', codigo: 'PC' }]);

      const result = await insertTree({
        grupoId: 'sg-1',
        grupoCodigo: 'L1',
        especieId: 'esp-1',
        especieCodigo: 'ANC',
        userId: 'user-1',
      });

      expect(result.posicion).toBe(1);
      expect(result.subId).toBe('PCL1ANC1');
      expect(mockInsertValues).toHaveBeenCalledTimes(1);
      const row = mockInsertValues.mock.calls[0][0];
      expect(row.posicion).toBe(1);
      expect(row.especieId).toBe('esp-1');
      expect(row.groupId).toBe('sg-1');
    });

    it('inserts tree with auto-incremented position based on MAX(posicion)', async () => {
      mockDb = buildMockDb([{ maxPos: 3, parcelaId: 'p1', codigo: 'PC' }]);

      const result = await insertTree({
        grupoId: 'sg-1',
        grupoCodigo: 'L1',
        especieId: 'esp-1',
        especieCodigo: 'ANC',
        userId: 'user-1',
      });

      expect(result.posicion).toBe(4);
      expect(result.subId).toBe('PCL1ANC4');
    });

    it('generates correct subId as concatenation parcelaCodigo+grupoCodigo+especieCodigo+posicion', async () => {
      mockDb = buildMockDb([{ maxPos: 12, parcelaId: 'p1', codigo: 'PC' }]);

      const result = await insertTree({
        grupoId: 'sg-1',
        grupoCodigo: 'L23B',
        especieId: 'esp-2',
        especieCodigo: 'ANC',
        userId: 'user-1',
      });

      expect(result.subId).toBe('PCL23BANC13');
    });

    it('stores null especieId for N/N trees', async () => {
      mockDb = buildMockDb([{ maxPos: 0, parcelaId: 'p1', codigo: 'PC' }]);

      await insertTree({
        grupoId: 'sg-1',
        grupoCodigo: 'L1',
        especieId: null,
        especieCodigo: 'NN',
        userId: 'user-1',
      });

      const row = mockInsertValues.mock.calls[0][0];
      expect(row.especieId).toBeNull();
    });

    it('calls notifyDataChanged after insert', async () => {
      mockDb = buildMockDb([{ maxPos: null, parcelaId: 'p1', codigo: 'PC' }]);
      const { notifyDataChanged } = require('../../src/database/liveQuery');

      await insertTree({
        grupoId: 'sg-1',
        grupoCodigo: 'L1',
        especieId: 'esp-1',
        especieCodigo: 'ANC',
        userId: 'user-1',
      });

      expect(notifyDataChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteLastTree', () => {
    it('deletes the tree with the highest posicion', async () => {
      mockDb = buildMockDb([{ maxPos: 5, id: 'tree-5', plantacionId: 'plant-1' }]);

      const result = await deleteLastTree('sg-1');

      expect(result.deleted).toBe(true);
      expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
    });

    // Es el camino de borrado más usado: sin anotarlo, el pull lo resucita (#467).
    it('anota el borrado para propagarlo al server', async () => {
      mockDb = buildMockDb([{ maxPos: 5, id: 'tree-5', plantacionId: 'plant-1' }]);

      await deleteLastTree('sg-1');

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'tree-5', tipo: ENTIDAD_BORRADA.arbol, grupoId: 'sg-1' }),
      );
    });

    it('returns deleted=false and does not call delete when subgroup has no trees', async () => {
      mockDb = buildMockDb([{ maxPos: null, id: null }]);

      const result = await deleteLastTree('sg-1');

      expect(result.deleted).toBe(false);
      expect(mockDeleteWhere).not.toHaveBeenCalled();
    });

    // Sin esto el archivo de la foto queda ocupando espacio para siempre (#490).
    it('borra el archivo de la foto después de la transacción', async () => {
      mockDb = buildMockDb([{ maxPos: 5, id: 'tree-5', fotoUrl: FOTO_VIEJA, plantacionId: 'plant-1' }]);
      const orden: string[] = [];
      mockDeleteWhere.mockImplementation(() => { orden.push('delete'); return Promise.resolve(undefined); });
      mockBorrarFotos.mockImplementation(() => { orden.push('borrar'); });

      await deleteLastTree('sg-1');

      expect(mockBorrarFotos).toHaveBeenCalledWith([FOTO_VIEJA]);
      expect(orden).toEqual(['delete', 'borrar']);
    });

    it('si la transacción falla, no borra el archivo', async () => {
      mockDb = buildMockDb([{ maxPos: 5, id: 'tree-5', fotoUrl: FOTO_VIEJA, plantacionId: 'plant-1' }]);
      (enTransaccion as jest.Mock).mockRejectedValueOnce(new Error('DB crash'));

      await expect(deleteLastTree('sg-1')).rejects.toThrow('DB crash');

      expect(mockBorrarFotos).not.toHaveBeenCalled();
    });

    it('un árbol sin foto no intenta borrar archivos', async () => {
      mockDb = buildMockDb([{ maxPos: 5, id: 'tree-5', fotoUrl: null, plantacionId: 'plant-1' }]);

      await deleteLastTree('sg-1');

      expect(mockBorrarFotos).not.toHaveBeenCalled();
    });

    it('calls notifyDataChanged only when a tree is deleted', async () => {
      mockDb = buildMockDb([{ maxPos: 2, id: 'tree-2', plantacionId: 'plant-1' }]);
      const { notifyDataChanged } = require('../../src/database/liveQuery');

      await deleteLastTree('sg-1');

      expect(notifyDataChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('reverseTreeOrder', () => {
    it('runs in a transaction', async () => {
      // [0] lleva parcelaId + codigo para el lookup de getGroupParcelaCodigo.
      const trees = [
        { id: 'tree-1', grupoId: 'sg-1', posicion: 1, especieId: null, subId: 'L1NN1', fotoUrl: null, usuarioRegistro: 'u', createdAt: '', parcelaId: 'p1', codigo: 'PC' },
        { id: 'tree-2', grupoId: 'sg-1', posicion: 2, especieId: null, subId: 'L1NN2', fotoUrl: null, usuarioRegistro: 'u', createdAt: '' },
      ];
      mockDb = buildMockDb(trees);

      await reverseTreeOrder('sg-1', 'L1');

      expect(enTransaccion).toHaveBeenCalledTimes(1);
    });

    it('updates all trees when reversing order', async () => {
      const trees = [
        { id: 'tree-1', grupoId: 'sg-1', posicion: 1, especieId: null, subId: 'L1NN1', fotoUrl: null, usuarioRegistro: 'u', createdAt: '', parcelaId: 'p1', codigo: 'PC' },
        { id: 'tree-2', grupoId: 'sg-1', posicion: 2, especieId: null, subId: 'L1NN2', fotoUrl: null, usuarioRegistro: 'u', createdAt: '' },
        { id: 'tree-3', grupoId: 'sg-1', posicion: 3, especieId: null, subId: 'L1NN3', fotoUrl: null, usuarioRegistro: 'u', createdAt: '' },
      ];
      mockDb = buildMockDb(trees);

      await reverseTreeOrder('sg-1', 'L1');

      // 3 updates inside transaction (one per tree) + 1 for markGroupPendingSync
      expect(mockUpdateWhere).toHaveBeenCalledTimes(4);
    });

    it('does nothing when subgroup is empty', async () => {
      mockDb = buildMockDb([]);

      await reverseTreeOrder('sg-1', 'L1');

      expect(enTransaccion).not.toHaveBeenCalled();
      expect(mockUpdateWhere).not.toHaveBeenCalled();
    });
  });

  describe('resolveNNTree', () => {
    it('sets especieId and recalculates subId', async () => {
      let callCount = 0;
      mockDb = {
        ...buildMockDb([]),
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve([{ codigo: 'ANC' }]); // especie
              if (callCount === 2) return Promise.resolve([{ posicion: 3, grupoId: 'sg-1' }]); // árbol
              if (callCount === 3) return Promise.resolve([{ parcelaId: 'p1' }]); // grupo (getGroupParcelaCodigo)
              return Promise.resolve([{ codigo: 'PC' }]); // parcela
            }),
          })),
        })),
      };

      await resolveNNTree('tree-1', 'esp-1', 'L1');

      // Called twice: once for tree update, once for markGroupPendingSync
      expect(mockUpdateWhere).toHaveBeenCalledTimes(2);
    });

    it('does nothing if species or tree not found', async () => {
      mockDb = buildMockDb([]);

      await resolveNNTree('tree-nonexistent', 'esp-nonexistent', 'L1');

      expect(mockUpdateWhere).not.toHaveBeenCalled();
    });
  });

  describe('updateTreePhoto', () => {
    // El select del árbol y el de la plantación del grupo leen la misma fila.
    const arbolExistente = [{ grupoId: 'sg-1', plantacionId: 'plant-1' }];

    it('calls db update with provided fotoUrl', async () => {
      mockDb = buildMockDb(arbolExistente);

      await updateTreePhoto('tree-1', 'file://document/photos/photo_123.jpg');

      // El árbol y la marca de pendiente del grupo.
      expect(mockUpdateWhere).toHaveBeenCalledTimes(2);
    });

    it('sets fotoUrl to empty string when empty string passed', async () => {
      mockDb = buildMockDb(arbolExistente);

      await updateTreePhoto('tree-1', '');

      // El árbol y la marca de pendiente del grupo.
      expect(mockUpdateWhere).toHaveBeenCalledTimes(2);
    });

    // Reemplazar o quitar la foto dejaba el archivo anterior en el device (#490).
    it('al reemplazar la foto borra el archivo anterior después del update', async () => {
      mockDb = buildMockDb([{ fotoUrl: FOTO_VIEJA, grupoId: 'sg-1' }]);
      const orden: string[] = [];
      mockUpdateWhere.mockImplementation(() => { orden.push('update'); return Promise.resolve(undefined); });
      mockBorrarFotos.mockImplementation(() => { orden.push('borrar'); });

      await updateTreePhoto('tree-1', FOTO_NUEVA);

      expect(mockBorrarFotos).toHaveBeenCalledWith([FOTO_VIEJA]);
      // El segundo update es el pendingSync del grupo.
      expect(orden.slice(0, 2)).toEqual(['update', 'borrar']);
    });

    it('al quitar la foto borra el archivo anterior', async () => {
      mockDb = buildMockDb([{ fotoUrl: FOTO_VIEJA, grupoId: 'sg-1' }]);

      await updateTreePhoto('tree-1', '');

      expect(mockBorrarFotos).toHaveBeenCalledWith([FOTO_VIEJA]);
    });

    // El archivo "anterior" es el mismo que queda en la fila.
    it('con el mismo path no borra el archivo nuevo', async () => {
      mockDb = buildMockDb([{ fotoUrl: FOTO_NUEVA, grupoId: 'sg-1' }]);

      await updateTreePhoto('tree-1', FOTO_NUEVA);

      expect(mockBorrarFotos).not.toHaveBeenCalled();
    });

    it('sin foto anterior no intenta borrar archivos', async () => {
      mockDb = buildMockDb([{ fotoUrl: null, grupoId: 'sg-1' }]);

      await updateTreePhoto('tree-1', FOTO_NUEVA);

      expect(mockBorrarFotos).not.toHaveBeenCalled();
    });

    it('si el update falla, no borra el archivo anterior', async () => {
      mockDb = buildMockDb([{ fotoUrl: FOTO_VIEJA, grupoId: 'sg-1' }]);
      mockUpdateWhere.mockRejectedValueOnce(new Error('DB crash'));

      await expect(updateTreePhoto('tree-1', FOTO_NUEVA)).rejects.toThrow('DB crash');

      expect(mockBorrarFotos).not.toHaveBeenCalled();
    });

    it('resets fotoSynced to false when updating photo', async () => {
      const sets: any[] = [];
      mockDb = {
        ...buildMockDb(arbolExistente),
        update: jest.fn(() => ({
          set: jest.fn((values: any) => {
            sets.push(values);
            return { where: mockUpdateWhere };
          }),
        })),
      };

      await updateTreePhoto('tree-1', 'file://document/photos/photo_new.jpg');

      expect(sets[0]).toEqual(expect.objectContaining({ fotoSynced: false }));
    });

    // Sin el registro, el pull restaura la foto del server y se vuelve a bajar (#498).
    it('quitar la foto la anota para propagarlo al server', async () => {
      mockDb = buildMockDb(arbolExistente);

      await updateTreePhoto('tree-1', '');

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'tree-1', tipo: ENTIDAD_BORRADA.foto, grupoId: 'sg-1', plantacionId: 'plant-1' }),
      );
    });

    // Si quedara anotada, el push pondría en null la foto nueva en el server.
    it('poner otra foto descarta la quitada y no anota nada', async () => {
      mockDb = buildMockDb(arbolExistente);

      await updateTreePhoto('tree-1', 'file://document/photos/photo_new.jpg');

      expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it('el update y el registro van en la misma transacción', async () => {
      mockDb = buildMockDb(arbolExistente);
      let dentro = false;
      (enTransaccion as jest.Mock).mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => {
        dentro = true;
        try {
          return await cb(jest.requireMock('../../src/database/client').db);
        } finally {
          dentro = false;
        }
      });
      const vistos: boolean[] = [];
      mockUpdateWhere.mockImplementation(() => { vistos.push(dentro); return Promise.resolve(undefined); });
      mockInsertValues.mockImplementation(() => { vistos.push(dentro); });

      await updateTreePhoto('tree-1', '');

      expect(vistos.slice(0, 2)).toEqual([true, true]);
    });

    it('un árbol inexistente no escribe nada', async () => {
      mockDb = buildMockDb([]);

      await updateTreePhoto('tree-fantasma', '');

      expect(mockUpdateWhere).not.toHaveBeenCalled();
      expect(mockInsertValues).not.toHaveBeenCalled();
    });
  });

  describe('deleteTreeAndRecalculate', () => {
    const remainingTrees = [
      { id: 'tree-2', grupoId: 'sg-1', posicion: 2, especieId: null, subId: 'L1NN2', fotoUrl: null, usuarioRegistro: 'u', createdAt: '' },
      { id: 'tree-3', grupoId: 'sg-1', posicion: 3, especieId: null, subId: 'L1NN3', fotoUrl: null, usuarioRegistro: 'u', createdAt: '' },
    ];

    /**
     * Los selects se responden por orden de llamada, que es el del código:
     * plantación del grupo, parcela del grupo, código de la parcela, foto del árbol,
     * y recién ahí los árboles que quedan.
     */
    function mockearSelects() {
      const respuestas: any[][] = [
        [{ plantacionId: 'plant-1' }],
        [{ parcelaId: 'p1' }],
        [{ codigo: 'PC' }],
        [{ fotoUrl: FOTO_VIEJA }],
      ];
      return jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            const result: any = Promise.resolve(respuestas.shift() ?? remainingTrees);
            result.orderBy = jest.fn(() => Promise.resolve(remainingTrees));
            return result;
          }),
          leftJoin: jest.fn(() => ({
            where: jest.fn(() => ({ orderBy: jest.fn(() => Promise.resolve(remainingTrees)) })),
          })),
        })),
      }));
    }

    beforeEach(() => {
      mockDb = {
        delete: jest.fn(() => ({ where: mockDeleteWhere })),
        // El registro del borrado encadena `.onConflictDoUpdate()`; el mock
        // compartido del archivo devuelve una promesa pelada.
        insert: jest.fn(() => ({
          values: jest.fn((valores: unknown) => {
            mockInsertValues(valores);
            return { onConflictDoUpdate: jest.fn().mockResolvedValue(undefined) };
          }),
        })),
        update: jest.fn(() => ({ set: jest.fn(() => ({ where: mockUpdateWhere })) })),
        select: mockearSelects(),
      };
    });

    it('deletes tree and runs transaction to recalculate positions', async () => {
      await deleteTreeAndRecalculate('tree-1', 'sg-1', 'L1');

      expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
      expect(enTransaccion).toHaveBeenCalledTimes(1);
    });

    // Sin el registro, el borrado vive solo en SQLite: el pull lo resucita en la
    // misma sincronización y la renumeración deja SubIDs duplicados (#467).
    it('anota el borrado para propagarlo al server', async () => {
      await deleteTreeAndRecalculate('tree-1', 'sg-1', 'L1');

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'tree-1', tipo: ENTIDAD_BORRADA.arbol, grupoId: 'sg-1', plantacionId: 'plant-1' }),
      );
    });

    // Si el registro quedara fuera de la transacción, un corte entre el delete y el
    // insert deja el borrado sin propagar y vuelve el bug.
    it('el borrado y su registro van en la misma transacción', async () => {
      let dentro = false;
      (enTransaccion as jest.Mock).mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => {
        dentro = true;
        try {
          return await cb(jest.requireMock('../../src/database/client').db);
        } finally {
          dentro = false;
        }
      });
      const vistos: boolean[] = [];
      mockDeleteWhere.mockImplementation(() => { vistos.push(dentro); return Promise.resolve(undefined); });
      mockInsertValues.mockImplementation(() => { vistos.push(dentro); });

      await deleteTreeAndRecalculate('tree-1', 'sg-1', 'L1');

      expect(vistos).toEqual([true, true]);
    });

    // Sin esto el archivo de la foto queda ocupando espacio para siempre (#490).
    it('borra el archivo de la foto después de la transacción', async () => {
      const orden: string[] = [];
      mockDeleteWhere.mockImplementation(() => { orden.push('delete'); return Promise.resolve(undefined); });
      mockBorrarFotos.mockImplementation(() => { orden.push('borrar'); });

      await deleteTreeAndRecalculate('tree-1', 'sg-1', 'L1');

      expect(mockBorrarFotos).toHaveBeenCalledWith([FOTO_VIEJA]);
      expect(orden).toEqual(['delete', 'borrar']);
    });

    it('si la transacción falla, no borra el archivo', async () => {
      (enTransaccion as jest.Mock).mockRejectedValueOnce(new Error('DB crash'));

      await expect(deleteTreeAndRecalculate('tree-1', 'sg-1', 'L1')).rejects.toThrow('DB crash');

      expect(mockBorrarFotos).not.toHaveBeenCalled();
    });

    // El grupo es de donde sale la plantación: sin él no hay a quién propagarle el
    // borrado, y anotarlo mal sería peor que no anotarlo.
    it('un grupo inexistente corta antes de borrar nada', async () => {
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })),
      }));

      await expect(deleteTreeAndRecalculate('tree-1', 'sg-fantasma', 'L1')).rejects.toThrow('inexistente');
      expect(mockDeleteWhere).not.toHaveBeenCalled();
    });
  });
});
