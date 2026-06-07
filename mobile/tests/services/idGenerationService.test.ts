import { generateAndPersistIds } from '../../src/services/idGenerationService';
import { generateIds } from '../../src/repositories/PlantationRepository';
import { persistGeneratedTreeIds } from '../../src/services/sync/pushService';
import { markGroupSynced } from '../../src/repositories/GroupRepository';

jest.mock('../../src/repositories/PlantationRepository', () => ({ generateIds: jest.fn() }));
jest.mock('../../src/services/sync/pushService', () => ({ persistGeneratedTreeIds: jest.fn() }));
jest.mock('../../src/repositories/GroupRepository', () => ({ markGroupSynced: jest.fn() }));

const mockGenerate = generateIds as jest.Mock;
const mockPersist = persistGeneratedTreeIds as jest.Mock;
const mockMarkSynced = markGroupSynced as jest.Mock;

const assignedIds = [
  { id: 't1', plantacionId: 1, globalId: 100 },
  { id: 't2', plantacionId: 2, globalId: 101 },
];

describe('generateAndPersistIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerate.mockResolvedValue({ assignedIds, affectedGroupIds: ['g1', 'g2'] });
    mockMarkSynced.mockResolvedValue(undefined);
  });

  it('persiste los IDs vía RPC con las tuplas asignadas', async () => {
    mockPersist.mockResolvedValue({ success: true, updated: 2 });
    await generateAndPersistIds('p1', 100);
    expect(mockPersist).toHaveBeenCalledWith(assignedIds);
  });

  it('marca los grupos sincronizados y persisted=true cuando el server actualiza TODOS', async () => {
    mockPersist.mockResolvedValue({ success: true, updated: 2 });
    const result = await generateAndPersistIds('p1', 100);
    expect(mockMarkSynced).toHaveBeenCalledTimes(2);
    expect(mockMarkSynced).toHaveBeenCalledWith('g1');
    expect(mockMarkSynced).toHaveBeenCalledWith('g2');
    expect(result).toEqual({ total: 2, updated: 2, persisted: true });
  });

  it('NO marca sincronizado y persisted=false si el push falla', async () => {
    mockPersist.mockResolvedValue({ success: false, updated: 0 });
    const result = await generateAndPersistIds('p1', 100);
    expect(mockMarkSynced).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 2, updated: 0, persisted: false });
  });

  it('NO marca sincronizado si el server actualizó menos filas que las enviadas (parcial)', async () => {
    mockPersist.mockResolvedValue({ success: true, updated: 1 });
    const result = await generateAndPersistIds('p1', 100);
    expect(mockMarkSynced).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 2, updated: 1, persisted: false });
  });
});
