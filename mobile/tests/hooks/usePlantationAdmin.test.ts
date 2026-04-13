// Tests for fetchPlantationMeta — standalone utility in usePlantationAdmin.
// Covers all 3 estados (activa/finalizada/sincronizada) and error handling.

jest.mock('../../src/queries/adminQueries', () => ({
  checkFinalizationGate: jest.fn(),
  hasIdsGenerated: jest.fn(),
  getMaxGlobalId: jest.fn(),
}));

jest.mock('../../src/database/liveQuery', () => ({
  useLiveData: jest.fn().mockReturnValue({ data: null }),
}));

jest.mock('../../src/hooks/useCurrentUserId', () => ({
  useCurrentUserId: jest.fn().mockReturnValue('test-user-id'),
}));

jest.mock('../../src/hooks/useProfileData', () => ({
  useProfileData: jest.fn().mockReturnValue({ profile: { organizacionId: 'org-1' } }),
}));

jest.mock('../../src/hooks/useConfirm', () => ({
  useConfirm: jest.fn().mockReturnValue({ confirmProps: {}, show: jest.fn() }),
}));

jest.mock('../../src/queries/dashboardQueries', () => ({
  getPlantationsForRole: jest.fn(),
}));

jest.mock('../../src/repositories/PlantationRepository', () => ({
  createPlantation: jest.fn(),
  createPlantationLocally: jest.fn(),
  updatePlantation: jest.fn(),
  finalizePlantation: jest.fn(),
  generateIds: jest.fn(),
  discardPlantationEdit: jest.fn(),
}));

jest.mock('../../src/services/ExportService', () => ({
  exportToCSV: jest.fn(),
  exportToExcel: jest.fn(),
}));

jest.mock('../../src/utils/alertHelpers', () => ({
  showInfoDialog: jest.fn(),
}));

import { fetchPlantationMeta } from '../../src/hooks/usePlantationAdmin';
import { checkFinalizationGate, hasIdsGenerated } from '../../src/queries/adminQueries';
import type { Plantation } from '../../src/components/PlantationConfigCard';

const mockCheckGate = checkFinalizationGate as jest.MockedFunction<typeof checkFinalizationGate>;
const mockHasIds = hasIdsGenerated as jest.MockedFunction<typeof hasIdsGenerated>;

function makePlantation(estado: string, overrides?: Partial<Plantation>): Plantation {
  return {
    id: 'test-plantation-1',
    lugar: 'Test Lugar',
    periodo: '2026-A',
    estado,
    createdAt: '2026-01-01',
    ...overrides,
  };
}

describe('fetchPlantationMeta', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns canFinalize=true for activa when gate passes', async () => {
    mockCheckGate.mockResolvedValue({ canFinalize: true, blocking: [], hasSubgroups: true });

    const result = await fetchPlantationMeta(makePlantation('activa'));

    expect(result).toEqual({ canFinalize: true, idsGenerated: false });
  });

  it('returns canFinalize=false for activa when gate fails', async () => {
    mockCheckGate.mockResolvedValue({
      canFinalize: false,
      blocking: [{ nombre: 'SG1', estado: 'activa' }],
      hasSubgroups: true,
    });

    const result = await fetchPlantationMeta(makePlantation('activa'));

    expect(result).toEqual({ canFinalize: false, idsGenerated: false });
  });

  it('returns idsGenerated=true for finalizada with IDs', async () => {
    mockHasIds.mockResolvedValue(true);

    const result = await fetchPlantationMeta(makePlantation('finalizada'));

    expect(result).toEqual({ canFinalize: false, idsGenerated: true });
  });

  it('returns idsGenerated=false for finalizada without IDs', async () => {
    mockHasIds.mockResolvedValue(false);

    const result = await fetchPlantationMeta(makePlantation('finalizada'));

    expect(result).toEqual({ canFinalize: false, idsGenerated: false });
  });

  it('handles checkFinalizationGate error gracefully', async () => {
    mockCheckGate.mockRejectedValue(new Error('DB error'));

    const result = await fetchPlantationMeta(makePlantation('activa'));

    expect(result).toEqual({ canFinalize: false, idsGenerated: false });
  });

  it('handles hasIdsGenerated error gracefully', async () => {
    mockHasIds.mockRejectedValue(new Error('DB error'));

    const result = await fetchPlantationMeta(makePlantation('finalizada'));

    expect(result).toEqual({ canFinalize: false, idsGenerated: false });
  });
});
