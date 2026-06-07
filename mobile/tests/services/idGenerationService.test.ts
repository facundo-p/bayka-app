import {
  generateAndPersistIds,
  retryPersistIds,
  deferIdsToSync,
} from '../../src/services/idGenerationService';
import { generateIds } from '../../src/repositories/PlantationRepository';
import { persistGeneratedTreeIds } from '../../src/services/sync/pushService';
import { markGroupPendingSync } from '../../src/repositories/GroupRepository';

jest.mock('../../src/repositories/PlantationRepository', () => ({ generateIds: jest.fn() }));
jest.mock('../../src/services/sync/pushService', () => ({ persistGeneratedTreeIds: jest.fn() }));
jest.mock('../../src/repositories/GroupRepository', () => ({ markGroupPendingSync: jest.fn() }));

const mockGenerate = generateIds as jest.Mock;
const mockPersist = persistGeneratedTreeIds as jest.Mock;
const mockMarkPending = markGroupPendingSync as jest.Mock;

const assignedIds = [
  { id: 't1', plantacionId: 1, globalId: 100 },
  { id: 't2', plantacionId: 2, globalId: 101 },
];
const affectedGroupIds = ['g1', 'g2'];

describe('idGenerationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerate.mockResolvedValue({ assignedIds, affectedGroupIds });
    mockMarkPending.mockResolvedValue(undefined);
  });

  describe('generateAndPersistIds', () => {
    it('genera y sube los IDs vía RPC; persisted=true cuando el server actualiza TODOS', async () => {
      mockPersist.mockResolvedValue({ success: true, updated: 2 });
      const result = await generateAndPersistIds('p1', 100);
      expect(mockPersist).toHaveBeenCalledWith(assignedIds);
      expect(result).toEqual({ total: 2, updated: 2, persisted: true, assignedIds, affectedGroupIds });
    });

    it('NUNCA marca pendingSync por sí solo (ni en éxito ni en fallo)', async () => {
      mockPersist.mockResolvedValue({ success: false, updated: 0 });
      await generateAndPersistIds('p1', 100);
      expect(mockMarkPending).not.toHaveBeenCalled();
    });

    it('persisted=false si el push falla', async () => {
      mockPersist.mockResolvedValue({ success: false, updated: 0 });
      const result = await generateAndPersistIds('p1', 100);
      expect(result.persisted).toBe(false);
    });

    it('persisted=false si el server actualizó menos filas que las enviadas (parcial)', async () => {
      mockPersist.mockResolvedValue({ success: true, updated: 1 });
      const result = await generateAndPersistIds('p1', 100);
      expect(result.persisted).toBe(false);
    });
  });

  describe('retryPersistIds', () => {
    it('re-pushea las tuplas dadas sin re-generar', async () => {
      mockPersist.mockResolvedValue({ success: true, updated: 2 });
      const result = await retryPersistIds(assignedIds, affectedGroupIds);
      expect(mockGenerate).not.toHaveBeenCalled();
      expect(mockPersist).toHaveBeenCalledWith(assignedIds);
      expect(result.persisted).toBe(true);
    });
  });

  describe('deferIdsToSync', () => {
    it('marca pendingSync cada grupo afectado', async () => {
      await deferIdsToSync(affectedGroupIds);
      expect(mockMarkPending).toHaveBeenCalledTimes(2);
      expect(mockMarkPending).toHaveBeenCalledWith('g1');
      expect(mockMarkPending).toHaveBeenCalledWith('g2');
    });
  });
});
