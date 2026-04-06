// Tests for deletePlantationLocally — cascade delete of plantation and all related data
// Covers: DEL-01-cascade-delete

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn() },
  },
  isSupabaseConfigured: true,
}));

jest.mock('../../src/database/client', () => ({
  db: {
    transaction: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/services/SyncService', () => ({
  pullFromServer: jest.fn(),
}));

import { deletePlantationLocally } from '../../src/repositories/PlantationRepository';
import { db } from '../../src/database/client';
import { notifyDataChanged } from '../../src/database/liveQuery';

const mockDb = db as jest.Mocked<typeof db>;
const mockNotifyDataChanged = notifyDataChanged as jest.Mock;

describe('deletePlantationLocally', () => {
  let txDeleteCalls: string[];
  let mockTx: any;

  beforeEach(() => {
    jest.resetAllMocks();
    txDeleteCalls = [];

    // Build a transaction mock that records which tables get deleted
    mockTx = {
      delete: jest.fn().mockImplementation((table: any) => {
        // Extract table name from the drizzle table object
        const tableName = table?.[Symbol.for('drizzle:Name')] ?? table?._.name ?? 'unknown';
        txDeleteCalls.push(tableName);
        return {
          where: jest.fn().mockResolvedValue(undefined),
        };
      }),
    };

    (mockDb.transaction as jest.Mock).mockImplementation(async (fn) => {
      await fn(mockTx);
    });
  });

  it('Test 1: deletes the plantation row itself', async () => {
    await deletePlantationLocally('plant-1');

    expect(txDeleteCalls).toContain('plantations');
  });

  it('Test 2: deletes all subgroups with plantacionId = id', async () => {
    await deletePlantationLocally('plant-1');

    expect(txDeleteCalls).toContain('subgroups');
  });

  it('Test 3: deletes all trees belonging to those subgroups', async () => {
    await deletePlantationLocally('plant-1');

    expect(txDeleteCalls).toContain('trees');
  });

  it('Test 4: deletes plantationSpecies, plantationUsers, userSpeciesOrder rows', async () => {
    await deletePlantationLocally('plant-1');

    expect(txDeleteCalls).toContain('plantation_species');
    expect(txDeleteCalls).toContain('plantation_users');
    expect(txDeleteCalls).toContain('user_species_order');
  });

  it('Test 5: if the DB throws mid-transaction, no partial data is deleted (transaction rolls back)', async () => {
    (mockDb.transaction as jest.Mock).mockRejectedValue(new Error('DB crash'));

    await expect(deletePlantationLocally('plant-1')).rejects.toThrow('DB crash');

    // notifyDataChanged should NOT be called on error
    expect(mockNotifyDataChanged).not.toHaveBeenCalled();
  });

  it('calls notifyDataChanged after successful transaction', async () => {
    await deletePlantationLocally('plant-1');

    expect(mockNotifyDataChanged).toHaveBeenCalledTimes(1);
  });

  it('deletes all 6 tables inside the transaction', async () => {
    await deletePlantationLocally('plant-1');

    // Should delete exactly 6 tables
    expect(txDeleteCalls).toHaveLength(6);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('deletes trees before subgroups (correct order for FK safety)', async () => {
    await deletePlantationLocally('plant-1');

    const treesIdx = txDeleteCalls.indexOf('trees');
    const subgroupsIdx = txDeleteCalls.indexOf('subgroups');
    expect(treesIdx).toBeLessThan(subgroupsIdx);
  });
});
