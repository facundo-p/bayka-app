/** usePlantaciones.handleRefresh sin sesión del servidor (#658): no sube ni baja nada. */
import { act, renderHook } from '@testing-library/react-native';

const mockEnsureServerSession = jest.fn();
const mockUploadPendingEdits = jest.fn();
const mockPullFromServer = jest.fn();
const mockNotifyDataChanged = jest.fn();

jest.mock('../../src/services/SyncService', () => ({
  ensureServerSession: () => mockEnsureServerSession(),
  uploadPendingEdits: () => mockUploadPendingEdits(),
  pullFromServer: (...args: unknown[]) => mockPullFromServer(...args),
}));
jest.mock('../../src/database/liveQuery', () => ({
  useLiveData: () => ({ data: [{ id: 'p-1', estado: 'activa' }] }),
  notifyDataChanged: () => mockNotifyDataChanged(),
}));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../../src/hooks/useCurrentUserId', () => ({ useCurrentUserId: () => 'user-1' }));
jest.mock('../../src/hooks/useNetStatus', () => ({ useNetStatus: () => ({ isOnline: true }) }));
jest.mock('../../src/hooks/useProfileData', () => ({ useProfileData: () => ({ profile: null }) }));
jest.mock('../../src/hooks/useRoutePrefix', () => ({ useRoutePrefix: () => '(admin)' }));
jest.mock('../../src/hooks/useConfirm', () => ({ useConfirm: () => ({ show: jest.fn(), confirmProps: {} }) }));
jest.mock('../../src/hooks/useEliminarDelDispositivo', () => ({ useEliminarDelDispositivo: () => jest.fn() }));
jest.mock('../../src/hooks/useDescartarPendientes', () => ({ useDescartarPendientes: () => jest.fn() }));
jest.mock('../../src/queries/pendientesVaradosQueries', () => ({ getPendientesVarados: jest.fn() }));
jest.mock('../../src/queries/freshnessQueries', () => ({ checkFreshness: jest.fn() }));
jest.mock('../../src/queries/dashboardQueries', () => ({
  getPlantationsForRole: jest.fn(),
  getSyncedTreeCounts: jest.fn(),
  getPendingSyncCounts: jest.fn(),
  getTodayTreeCounts: jest.fn(),
  getTotalTreeCounts: jest.fn(),
  getUnresolvedNNCountsPerPlantation: jest.fn(),
}));

import { usePlantaciones } from '../../src/hooks/usePlantaciones';

describe('usePlantaciones.handleRefresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('sin sesión del servidor no sube ediciones ni hace pull', async () => {
    mockEnsureServerSession.mockRejectedValue(Object.assign(new Error('SESSION_EXPIRED'), { name: 'SessionExpiredError' }));
    const { result } = renderHook(() => usePlantaciones());

    await act(() => result.current.handleRefresh());

    expect(mockUploadPendingEdits).not.toHaveBeenCalled();
    expect(mockPullFromServer).not.toHaveBeenCalled();
    expect(result.current.refreshing).toBe(false);
  });

  it('con sesión sube las ediciones y hace pull de cada plantación', async () => {
    mockEnsureServerSession.mockResolvedValue(undefined);
    const { result } = renderHook(() => usePlantaciones());

    await act(() => result.current.handleRefresh());

    expect(mockUploadPendingEdits).toHaveBeenCalledTimes(1);
    expect(mockPullFromServer).toHaveBeenCalledWith('p-1');
    expect(mockNotifyDataChanged).toHaveBeenCalledTimes(1);
  });
});
