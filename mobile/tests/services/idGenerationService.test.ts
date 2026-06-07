import { generateAndPersistIds } from '../../src/services/idGenerationService';
import { generateIds, clearGeneratedIds } from '../../src/repositories/PlantationRepository';
import { persistGeneratedTreeIds } from '../../src/services/sync/pushService';

jest.mock('../../src/repositories/PlantationRepository', () => ({
  generateIds: jest.fn(),
  clearGeneratedIds: jest.fn(),
}));
jest.mock('../../src/services/sync/pushService', () => ({ persistGeneratedTreeIds: jest.fn() }));

const mockGenerate = generateIds as jest.Mock;
const mockClear = clearGeneratedIds as jest.Mock;
const mockPersist = persistGeneratedTreeIds as jest.Mock;

const assignedIds = [
  { id: 't1', plantacionId: 1, globalId: 100 },
  { id: 't2', plantacionId: 2, globalId: 101 },
];

describe('generateAndPersistIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerate.mockResolvedValue({ assignedIds, affectedGroupIds: ['g1', 'g2'] });
    mockClear.mockResolvedValue(undefined);
  });

  it('sube los IDs vía RPC con las tuplas asignadas', async () => {
    mockPersist.mockResolvedValue({ success: true, updated: 2 });
    await generateAndPersistIds('p1', 100);
    expect(mockPersist).toHaveBeenCalledWith(assignedIds);
  });

  it('persisted=true y NO revierte cuando el server actualiza TODOS', async () => {
    mockPersist.mockResolvedValue({ success: true, updated: 2 });
    const result = await generateAndPersistIds('p1', 100);
    expect(result).toEqual({ total: 2, updated: 2, persisted: true });
    expect(mockClear).not.toHaveBeenCalled();
  });

  it('REVIERTE los IDs locales y persisted=false si el push falla', async () => {
    mockPersist.mockResolvedValue({ success: false, updated: 0 });
    const result = await generateAndPersistIds('p1', 100);
    expect(result.persisted).toBe(false);
    expect(mockClear).toHaveBeenCalledWith('p1');
  });

  it('REVIERTE los IDs locales si el push queda parcial (updated < total)', async () => {
    mockPersist.mockResolvedValue({ success: true, updated: 1 });
    const result = await generateAndPersistIds('p1', 100);
    expect(result.persisted).toBe(false);
    expect(mockClear).toHaveBeenCalledWith('p1');
  });
});
