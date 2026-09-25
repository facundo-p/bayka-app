/** useCatalog sin sesión del servidor (#658): no consulta y pide iniciar sesión con conexión. */
import { renderHook, waitFor } from '@testing-library/react-native';

const mockEnsureServerSession = jest.fn();
const mockGetServerCatalog = jest.fn();
/** Estable entre renders: el efecto que carga el catálogo depende del perfil. */
const mockPerfil = { profile: { organizacionId: 'org-1' } };

jest.mock('../../src/services/SyncService', () => {
  const guard = jest.requireActual('../../src/services/sync/sessionGuard');
  return {
    ...jest.requireActual('../../src/services/sync/types'),
    esSesionExpirada: guard.esSesionExpirada,
    SessionExpiredError: guard.SessionExpiredError,
    ensureServerSession: () => mockEnsureServerSession(),
    batchDownload: jest.fn(),
  };
});
jest.mock('../../src/queries/catalogQueries', () => ({
  getServerCatalog: (...args: unknown[]) => mockGetServerCatalog(...args),
  getLocalPlantationIds: jest.fn(),
}));
jest.mock('../../src/database/liveQuery', () => ({ useLiveData: () => ({ data: new Set() }) }));
jest.mock('../../src/hooks/useCurrentUserId', () => ({ useCurrentUserId: () => 'user-1' }));
jest.mock('../../src/hooks/useProfileData', () => ({ useProfileData: () => mockPerfil }));
jest.mock('../../src/hooks/useNetStatus', () => ({ useNetStatus: () => ({ isOnline: true }) }));
jest.mock('../../src/hooks/useRoutePrefix', () => ({ useRoutePrefix: () => '(admin)' }));

import { useCatalog } from '../../src/hooks/useCatalog';
import { SessionExpiredError } from '../../src/services/SyncService';

describe('useCatalog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerCatalog.mockResolvedValue([]);
  });

  it('sin sesión del servidor no consulta el catálogo y pide iniciar sesión con conexión', async () => {
    mockEnsureServerSession.mockRejectedValue(new SessionExpiredError());

    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.catalogError).not.toBeNull());

    expect(result.current.catalogError).toBe('Iniciá sesión con conexión para ver el catálogo.');
    expect(mockGetServerCatalog).not.toHaveBeenCalled();
  });

  it('otro error muestra el mensaje genérico', async () => {
    mockEnsureServerSession.mockResolvedValue(undefined);
    mockGetServerCatalog.mockRejectedValue(new Error('500'));

    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.catalogError).not.toBeNull());

    expect(result.current.catalogError).toBe('No se pudo cargar el catálogo');
  });
});
