// Tests for fetchPlantationMeta — standalone utility in usePlantationAdmin.

jest.mock('../../src/queries/adminQueries', () => ({
  checkFinalizationGate: jest.fn(),
  hasIdsGenerated: jest.fn(),
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

jest.mock('../../src/repositories/PlantationRepository', () => {
  class FinalizePlantationLocalSyncError extends Error {
    constructor(cause: unknown) {
      super('La plantación se finalizó en el servidor, pero no se pudo reflejar localmente');
      this.name = 'FinalizePlantationLocalSyncError';
      (this as any).cause = cause;
    }
  }
  return {
    createPlantation: jest.fn(),
    createPlantationLocally: jest.fn(),
    updatePlantation: jest.fn(),
    finalizePlantation: jest.fn(),
    discardPlantationEdit: jest.fn(),
    FinalizePlantationLocalSyncError,
  };
});

jest.mock('../../src/services/ExportService', () => ({
  exportToCSV: jest.fn(),
  exportToExcel: jest.fn(),
}));

jest.mock('../../src/utils/alertHelpers', () => ({
  showInfoDialog: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react-native';
import { fetchPlantationMeta, usePlantationAdmin } from '../../src/hooks/usePlantationAdmin';
import { checkFinalizationGate, hasIdsGenerated } from '../../src/queries/adminQueries';
import { useConfirm } from '../../src/hooks/useConfirm';
import { useCurrentUserId } from '../../src/hooks/useCurrentUserId';
import { useProfileData } from '../../src/hooks/useProfileData';
import { useLiveData } from '../../src/database/liveQuery';
import { finalizePlantation, FinalizePlantationLocalSyncError } from '../../src/repositories/PlantationRepository';
import { showInfoDialog } from '../../src/utils/alertHelpers';
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
    mockCheckGate.mockResolvedValue({ canFinalize: true, blocking: [], hasGroups: true, unresolvedNNCount: 0, unresolvedNNGroups: 0 });

    const result = await fetchPlantationMeta(makePlantation('activa'));

    expect(result).toEqual({ canFinalize: true, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0 });
  });

  it('returns canFinalize=false for activa when gate fails', async () => {
    mockCheckGate.mockResolvedValue({
      canFinalize: false,
      blocking: [{ nombre: 'SG1', estado: 'activa', pendingSync: false }],
      hasGroups: true,
      unresolvedNNCount: 0,
      unresolvedNNGroups: 0,
    });

    const result = await fetchPlantationMeta(makePlantation('activa'));

    expect(result).toEqual({ canFinalize: false, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0 });
  });

  it('returns idsGenerated=true for finalizada with IDs', async () => {
    mockHasIds.mockResolvedValue(true);

    const result = await fetchPlantationMeta(makePlantation('finalizada'));

    expect(result).toEqual({ canFinalize: false, idsGenerated: true, unresolvedNNCount: 0, unresolvedNNGroups: 0 });
  });

  it('returns idsGenerated=false for finalizada without IDs', async () => {
    mockHasIds.mockResolvedValue(false);

    const result = await fetchPlantationMeta(makePlantation('finalizada'));

    expect(result).toEqual({ canFinalize: false, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0 });
  });

  it('handles checkFinalizationGate error gracefully', async () => {
    mockCheckGate.mockRejectedValue(new Error('DB error'));

    const result = await fetchPlantationMeta(makePlantation('activa'));

    expect(result).toEqual({ canFinalize: false, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0 });
  });

  it('handles hasIdsGenerated error gracefully', async () => {
    mockHasIds.mockRejectedValue(new Error('DB error'));

    const result = await fetchPlantationMeta(makePlantation('finalizada'));

    expect(result).toEqual({ canFinalize: false, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0 });
  });
});

describe('usePlantationAdmin.handleFinalize', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (useCurrentUserId as jest.Mock).mockReturnValue('test-user-id');
    (useProfileData as jest.Mock).mockReturnValue({ profile: { organizacionId: 'org-1' } });
    (useLiveData as jest.Mock).mockReturnValue({ data: null });
  });

  it('FinalizePlantationLocalSyncError → info dialog aclarando que el server ya finalizó', async () => {
    mockCheckGate.mockResolvedValue({ canFinalize: true, blocking: [], hasGroups: true, unresolvedNNCount: 0, unresolvedNNGroups: 0 });
    const localSyncError = new FinalizePlantationLocalSyncError(new Error('SQLITE_BUSY'));
    (finalizePlantation as jest.Mock).mockRejectedValue(localSyncError);
    const mockShow = jest.fn();
    (useConfirm as jest.Mock).mockReturnValue({ confirmProps: {}, show: mockShow });

    const { result } = renderHook(() => usePlantationAdmin());
    await act(async () => {
      await result.current.handleFinalize('plantation-1');
    });

    const confirmCall = mockShow.mock.calls[0][0];
    const finalizarBtn = confirmCall.buttons.find((b: any) => b.label === 'Finalizar');
    await act(async () => {
      await finalizarBtn.onPress();
    });

    expect(showInfoDialog).toHaveBeenCalledWith(
      mockShow,
      'Plantacion finalizada',
      expect.stringContaining('proxima sincronizacion'),
      expect.any(String),
      expect.anything()
    );
  });

  it('error genérico de finalizePlantation → dialog "Error" con el mensaje original', async () => {
    mockCheckGate.mockResolvedValue({ canFinalize: true, blocking: [], hasGroups: true, unresolvedNNCount: 0, unresolvedNNGroups: 0 });
    (finalizePlantation as jest.Mock).mockRejectedValue(new Error('permission denied'));
    const mockShow = jest.fn();
    (useConfirm as jest.Mock).mockReturnValue({ confirmProps: {}, show: mockShow });

    const { result } = renderHook(() => usePlantationAdmin());
    await act(async () => {
      await result.current.handleFinalize('plantation-1');
    });

    const confirmCall = mockShow.mock.calls[0][0];
    const finalizarBtn = confirmCall.buttons.find((b: any) => b.label === 'Finalizar');
    await act(async () => {
      await finalizarBtn.onPress();
    });

    expect(showInfoDialog).toHaveBeenCalledWith(
      mockShow,
      'Error',
      'permission denied',
      expect.any(String),
      expect.anything()
    );
  });
});
