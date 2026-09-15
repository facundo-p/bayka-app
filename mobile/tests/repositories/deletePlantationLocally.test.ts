// Cascade delete of a plantation and all related data

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn() },
  },
  isSupabaseConfigured: true,
}));

jest.mock('../../src/database/client', () => ({
  db: {
    delete: jest.fn(),
  },
}));

// `enTransaccion` reemplaza a `db.transaction`, que con callbacks async commitea
// vacío (#448). Passthrough con `db`, que es lo que pasa el helper real.
jest.mock('../../src/database/transaccion', () => ({
  enTransaccion: jest.fn(),
}));

jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/services/SyncService', () => ({
  pullFromServer: jest.fn(),
}));

import { deletePlantationLocally } from '../../src/repositories/PlantationRepository';
import { db } from '../../src/database/client';
import { enTransaccion } from '../../src/database/transaccion';
import { notifyDataChanged } from '../../src/database/liveQuery';

const mockDb = db as jest.Mocked<typeof db>;
const mockEnTransaccion = enTransaccion as jest.Mock;
const mockNotifyDataChanged = notifyDataChanged as jest.Mock;

describe('deletePlantationLocally', () => {
  let txDeleteCalls: string[];

  beforeEach(() => {
    jest.resetAllMocks();
    txDeleteCalls = [];

    // El helper le pasa al callback el propio `db`, así que el registro de borrados
    // va sobre `db.delete`.
    (mockDb.delete as jest.Mock).mockImplementation((table: any) => {
      const tableName = table?.[Symbol.for('drizzle:Name')] ?? table?._.name ?? 'unknown';
      txDeleteCalls.push(tableName);
      return { where: jest.fn().mockResolvedValue(undefined) };
    });

    mockEnTransaccion.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb));
  });

  it('Test 1: deletes the plantation row itself', async () => {
    await deletePlantationLocally('plant-1');

    expect(txDeleteCalls).toContain('plantations');
  });

  it('Test 2: deletes all groups with plantacionId = id', async () => {
    await deletePlantationLocally('plant-1');

    expect(txDeleteCalls).toContain('groups');
  });

  it('Test 3: deletes all trees belonging to those groups', async () => {
    await deletePlantationLocally('plant-1');

    expect(txDeleteCalls).toContain('trees');
  });

  it('Test 4: deletes plantationSpecies, plantationUsers, userSpeciesOrder rows', async () => {
    await deletePlantationLocally('plant-1');

    expect(txDeleteCalls).toContain('plantation_species');
    expect(txDeleteCalls).toContain('plantation_users');
    expect(txDeleteCalls).toContain('user_species_order');
  });

  // El rollback en sí lo prueba tests/database/transaccion.test.ts: acá el callback
  // ni corre, solo se verifica que un fallo no dispare el refresco de la UI.
  it('Test 5: si la transacción falla, no se notifica el cambio de datos', async () => {
    mockEnTransaccion.mockRejectedValue(new Error('DB crash'));

    await expect(deletePlantationLocally('plant-1')).rejects.toThrow('DB crash');

    expect(mockNotifyDataChanged).not.toHaveBeenCalled();
  });

  it('calls notifyDataChanged after successful transaction', async () => {
    await deletePlantationLocally('plant-1');

    expect(mockNotifyDataChanged).toHaveBeenCalledTimes(1);
  });

  it('deletes all 7 tables inside the transaction (incluye parcelas, #90)', async () => {
    await deletePlantationLocally('plant-1');

    expect(txDeleteCalls).toHaveLength(7);
    expect(mockEnTransaccion).toHaveBeenCalledTimes(1);
  });

  it('deletes trees before groups, and groups before parcelas (FK safety)', async () => {
    await deletePlantationLocally('plant-1');

    const treesIdx = txDeleteCalls.indexOf('trees');
    const subgroupsIdx = txDeleteCalls.indexOf('groups');
    const parcelasIdx = txDeleteCalls.indexOf('parcelas');
    expect(treesIdx).toBeLessThan(subgroupsIdx);
    // #90: las parcelas se borran después de los groups que las referencian.
    expect(subgroupsIdx).toBeLessThan(parcelasIdx);
  });
});
