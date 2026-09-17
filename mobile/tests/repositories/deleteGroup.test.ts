// Borrado de un grupo: filas, registro del borrado y archivos de fotos (#490)

jest.mock('../../src/database/client', () => ({
  db: {
    select: jest.fn(),
    delete: jest.fn(),
    insert: jest.fn(),
  },
}));

jest.mock('../../src/database/transaccion', () => ({
  enTransaccion: jest.fn(),
}));

jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/repositories/BorradosRepository', () => ({
  plantacionDelGrupo: jest.fn(),
  registrarBorrado: jest.fn(),
}));

jest.mock('../../src/services/PhotoService', () => ({
  borrarFotosLocales: jest.fn(),
}));

import { deleteGroup } from '../../src/repositories/GroupRepository';
import { db } from '../../src/database/client';
import { enTransaccion } from '../../src/database/transaccion';
import { plantacionDelGrupo } from '../../src/repositories/BorradosRepository';
import { borrarFotosLocales } from '../../src/services/PhotoService';

const mockDb = db as jest.Mocked<typeof db>;
const mockEnTransaccion = enTransaccion as jest.Mock;
const mockBorrarFotos = borrarFotosLocales as jest.Mock;

const FOTOS = ['file://document/photos/photo_1.jpg', 'file://document/photos/photo_2.jpg'];

/** Los selects se responden en el orden del código: cantidad de árboles, fotos locales. */
function mockearSelects(respuestas: unknown[][]) {
  (mockDb.select as jest.Mock).mockImplementation(() => ({
    from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve(respuestas.shift() ?? [])) })),
  }));
}

describe('deleteGroup', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockearSelects([[{ count: 2 }], FOTOS.map((fotoUrl) => ({ fotoUrl }))]);
    (mockDb.delete as jest.Mock).mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    (plantacionDelGrupo as jest.Mock).mockResolvedValue('plant-1');
    mockEnTransaccion.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb));
  });

  // Sin esto cada grupo eliminado deja sus fotos ocupando espacio para siempre.
  it('borra los archivos de fotos locales después de la transacción', async () => {
    const orden: string[] = [];
    mockEnTransaccion.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      await cb(mockDb);
      orden.push('transaccion');
    });
    mockBorrarFotos.mockImplementation(() => { orden.push('borrar'); });

    const res = await deleteGroup('sg-1');

    expect(res).toEqual({ deleted: true, treeCount: 2 });
    expect(mockBorrarFotos).toHaveBeenCalledWith(FOTOS);
    expect(orden).toEqual(['transaccion', 'borrar']);
  });

  // Con rollback las filas siguen apuntando a esos archivos.
  it('si la transacción falla, no borra ningún archivo', async () => {
    mockEnTransaccion.mockRejectedValue(new Error('DB crash'));

    await expect(deleteGroup('sg-1')).rejects.toThrow('DB crash');

    expect(mockBorrarFotos).not.toHaveBeenCalled();
  });
});
