/** useCatalog: sin sesión (#658) y recarga al enfocar, pull-to-refresh y offline (#681). */
import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockEnsureServerSession = jest.fn();
const mockGetServerCatalog = jest.fn();
const mockBatchDownload = jest.fn();
let mockIsOnline = true;
/** Estable entre renders: la carga depende del perfil. */
const mockPerfil = { profile: { organizacionId: 'org-1' } };

jest.mock('../../src/services/SyncService', () => {
  const guard = jest.requireActual('../../src/services/sync/sessionGuard');
  return {
    ...jest.requireActual('../../src/services/sync/types'),
    esSesionExpirada: guard.esSesionExpirada,
    SessionExpiredError: guard.SessionExpiredError,
    ensureServerSession: () => mockEnsureServerSession(),
    batchDownload: (...args: unknown[]) => mockBatchDownload(...args),
  };
});
jest.mock('../../src/queries/catalogQueries', () => ({
  getServerCatalog: (...args: unknown[]) => mockGetServerCatalog(...args),
  getLocalPlantationIds: jest.fn(),
}));
jest.mock('../../src/database/liveQuery', () => ({ useLiveData: () => ({ data: new Set() }) }));
jest.mock('../../src/hooks/useCurrentUserId', () => ({ useCurrentUserId: () => 'user-1' }));
jest.mock('../../src/hooks/useProfileData', () => ({ useProfileData: () => mockPerfil }));
jest.mock('../../src/hooks/useNetStatus', () => ({ useNetStatus: () => ({ isOnline: mockIsOnline }) }));
// useFocusEffect se comporta como useEffect (pantalla siempre enfocada en el test).
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(callback, [callback]);
  },
}));
jest.mock('../../src/hooks/useRoutePrefix', () => ({ useRoutePrefix: () => '(admin)' }));

import { useCatalog } from '../../src/hooks/useCatalog';
import { SessionExpiredError } from '../../src/services/SyncService';

const plantacion = (id: string, estado = 'activa') => ({ id, lugar: id, estado });

describe('useCatalog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
    mockEnsureServerSession.mockResolvedValue(undefined);
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
    mockGetServerCatalog.mockRejectedValue(new Error('500'));

    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.catalogError).not.toBeNull());

    expect(result.current.catalogError).toBe('No se pudo cargar el catálogo');
  });

  describe('recarga con la lista ya cargada (#681)', () => {
    it('una recarga trae las plantaciones nuevas del servidor', async () => {
      mockGetServerCatalog.mockResolvedValueOnce([plantacion('a')]);
      const { result } = renderHook(() => useCatalog());
      await waitFor(() => expect(result.current.catalogItems).toHaveLength(1));

      mockGetServerCatalog.mockResolvedValueOnce([plantacion('a'), plantacion('b')]);
      await act(() => result.current.refreshCatalog());

      expect(result.current.catalogItems.map((p) => p.id)).toEqual(['a', 'b']);
    });

    it('no borra selección ni filtro y no muestra el spinner de pantalla completa', async () => {
      mockGetServerCatalog.mockResolvedValueOnce([plantacion('a'), plantacion('b', 'finalizada')]);
      const { result } = renderHook(() => useCatalog());
      await waitFor(() => expect(result.current.catalogItems).toHaveLength(2));
      act(() => {
        result.current.toggleSelection('a');
        result.current.setActiveFilter('activa');
      });

      let resolver: (v: unknown) => void = () => {};
      mockGetServerCatalog.mockReturnValueOnce(new Promise((r) => { resolver = r; }));
      let recarga: Promise<void> = Promise.resolve();
      act(() => { recarga = result.current.refreshCatalog(); });
      expect(result.current.loadingCatalog).toBe(false);
      expect(result.current.refreshing).toBe(true);
      await act(async () => { resolver([plantacion('a'), plantacion('c')]); await recarga; });

      expect(result.current.refreshing).toBe(false);
      expect(result.current.selectedIds.has('a')).toBe(true);
      expect(result.current.activeFilter).toBe('activa');
      expect(result.current.catalogItems).toHaveLength(2);
    });

    it('no recarga durante una descarga', async () => {
      mockGetServerCatalog.mockResolvedValue([plantacion('a')]);
      let terminar: (v: unknown[]) => void = () => {};
      mockBatchDownload.mockReturnValueOnce(new Promise((r) => { terminar = r; }));
      const { result } = renderHook(() => useCatalog());
      await waitFor(() => expect(result.current.catalogItems).toHaveLength(1));
      act(() => result.current.toggleSelection('a'));
      let descarga: Promise<void> = Promise.resolve();
      act(() => { descarga = result.current.handleBatchDownload(); });
      mockGetServerCatalog.mockClear();

      await act(() => result.current.refreshCatalog());
      expect(mockGetServerCatalog).not.toHaveBeenCalled();

      await act(async () => { terminar([]); await descarga; });
    });

    it('un fallo de red conserva la lista sin error', async () => {
      mockGetServerCatalog.mockResolvedValueOnce([plantacion('a')]);
      const { result } = renderHook(() => useCatalog());
      await waitFor(() => expect(result.current.catalogItems).toHaveLength(1));

      mockGetServerCatalog.mockRejectedValueOnce(new Error('Network request failed'));
      await act(() => result.current.refreshCatalog());

      expect(result.current.catalogItems).toHaveLength(1);
      expect(result.current.catalogError).toBeNull();
      expect(result.current.refreshing).toBe(false);
    });

    it('la sesión vencida avisa que hay que iniciar sesión', async () => {
      mockGetServerCatalog.mockResolvedValueOnce([plantacion('a')]);
      const { result } = renderHook(() => useCatalog());
      await waitFor(() => expect(result.current.catalogItems).toHaveLength(1));

      mockEnsureServerSession.mockRejectedValueOnce(new SessionExpiredError());
      await act(() => result.current.refreshCatalog());

      expect(result.current.catalogError).toBe('Iniciá sesión con conexión para ver el catálogo.');
    });

    it('offline conserva la lista anterior, marca sinConexion y no consulta', async () => {
      mockGetServerCatalog.mockResolvedValueOnce([plantacion('a')]);
      const { result, rerender } = renderHook(() => useCatalog());
      await waitFor(() => expect(result.current.catalogItems).toHaveLength(1));

      mockIsOnline = false;
      mockGetServerCatalog.mockClear();
      rerender({});

      await waitFor(() => expect(result.current.sinConexion).toBe(true));
      expect(result.current.catalogItems).toHaveLength(1);
      expect(result.current.catalogError).toBeNull();
      expect(mockGetServerCatalog).not.toHaveBeenCalled();
    });

    it('offline sin lista previa muestra el error genérico', async () => {
      mockIsOnline = false;
      const { result } = renderHook(() => useCatalog());
      await waitFor(() => expect(result.current.catalogError).toBe('No se pudo cargar el catálogo'));
    });
  });
});
