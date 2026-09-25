/**
 * Tests for usePlantacionesScreen — owns modal/dialog state and the handlers
 * wired to data hooks. Sub-hooks are mocked; only the hook's own state
 * transitions and calls into them are verified here.
 */
import { act, renderHook } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../src/hooks/useRoutePrefix', () => ({
  useRoutePrefix: () => '(admin)',
}));

const mockHandleDeletePlantation = jest.fn();
jest.mock('../../src/hooks/usePlantaciones', () => ({
  usePlantaciones: () => ({
    plantationList: [],
    filteredList: [],
    estadoCounts: { activa: 0, finalizada: 0 },
    activeFilter: null,
    setActiveFilter: jest.fn(),
    headerTitle: 'Plantaciones',
    headerSubtitle: undefined,
    isOnline: true,
    isAdmin: true,
    syncedCountMap: new Map(),
    pendingSyncMap: new Map(),
    todayCountMap: new Map(),
    totalCountMap: new Map(),
    nnCountMap: new Map(),
    handleDeletePlantation: mockHandleDeletePlantation,
    confirmProps: { visible: false },
  }),
}));

const mockHandleCreateSubmit = jest.fn();
const mockFetchPlantationMeta = jest.fn();
// Réplica mínima del comportamiento real de usePlantationAdmin.continuarLuegoDeCrear:
// sin duplicada corre directo; con duplicada, el test decide cuándo invocar el callback
// capturado (simula al usuario cerrando el aviso), nunca antes (#656).
const mockContinuarLuegoDeCrear = jest.fn((duplicada: boolean | undefined, siguientePaso: () => void) => {
  if (!duplicada) siguientePaso();
});
jest.mock('../../src/hooks/usePlantationAdmin', () => ({
  usePlantationAdmin: () => ({
    plantationList: [{ id: 'p1', lugar: 'Lote 1', pendingSync: false }],
    exportingId: null,
    confirmProps: { visible: false },
    handleFinalize: jest.fn(),
    handleExportCsv: jest.fn(),
    handleExportExcel: jest.fn(),
    handleExportKml: jest.fn(),
    handleCreateSubmit: mockHandleCreateSubmit,
    continuarLuegoDeCrear: mockContinuarLuegoDeCrear,
    handleEditSubmit: jest.fn(),
    handleDiscardEdit: jest.fn(),
  }),
  fetchPlantationMeta: (...args: unknown[]) => mockFetchPlantationMeta(...args),
}));

const mockStartGlobalSync = jest.fn();
const mockStartPlantationSync = jest.fn();
const mockResetSync = jest.fn();
jest.mock('../../src/hooks/useSync', () => ({
  useSync: () => ({
    state: 'idle',
    startGlobalSync: mockStartGlobalSync,
    startPlantationSync: mockStartPlantationSync,
    globalProgress: null,
    progress: null,
    results: [],
    parcelaResults: [],
    plantationResults: [],
    reset: mockResetSync,
    pullSuccess: null,
    authExpired: false,
    successCount: 0,
    failureCount: 0,
    parcelaFailureCount: 0,
    plantationFailureCount: 0,
    photoProgress: null,
    photoResult: null,
  }),
}));

const mockSignOut = jest.fn();
jest.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}));

jest.mock('../../src/hooks/usePendingSyncCount', () => ({
  usePendingSyncCount: () => ({ pendingCount: 0 }),
}));

jest.mock('../../src/hooks/usePendingSyncMap', () => ({
  usePendingSyncMap: () => new Map(),
}));

import { usePlantacionesScreen } from '../../src/hooks/usePlantacionesScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchPlantationMeta.mockResolvedValue({ canFinalize: false, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0, pendientesSinSubir: '' });
});

describe('usePlantacionesScreen — computed flags', () => {
  it('isSyncing es false y hasAnyPending false con estado idle y pendingCount 0', () => {
    const { result } = renderHook(() => usePlantacionesScreen());
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.hasAnyPending).toBe(false);
  });
});

describe('usePlantacionesScreen — creación y navegación (issue #63 + #15)', () => {
  it('sin duplicada: crea la plantación, abre config de especies directo y navega al detalle al cerrarla', async () => {
    mockHandleCreateSubmit.mockResolvedValue({ id: 'new-plantation-id', duplicada: false });
    const { result } = renderHook(() => usePlantacionesScreen());

    await act(async () => {
      await result.current.handleCreatePlantation({ lugar: 'Lote Nuevo', periodo: '2026-A', objetivoArboles: 500 } as any);
    });

    expect(mockHandleCreateSubmit).toHaveBeenCalledWith('Lote Nuevo', '2026-A', { objetivoArboles: 500 });
    expect(result.current.showCreateModal).toBe(false);
    expect(result.current.configSpeciesPlantacionId).toBe('new-plantation-id');

    act(() => {
      result.current.handleCloseConfigSpecies();
    });

    expect(result.current.configSpeciesPlantacionId).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/(admin)/plantation/new-plantation-id');
  });

  it('con duplicada: no abre config de especies hasta que se cierra el aviso (#656)', async () => {
    mockHandleCreateSubmit.mockResolvedValue({ id: 'dup-plantation-id', duplicada: true });
    const { result } = renderHook(() => usePlantacionesScreen());

    await act(async () => {
      await result.current.handleCreatePlantation({ lugar: 'Lote Dup', periodo: '2026-A' } as any);
    });

    // continuarLuegoDeCrear ya corrió con duplicada:true, pero el mock no invoca el callback
    // solo: el aviso "cierra" el modal de creación pero el de especies queda sin abrir todavía.
    expect(mockContinuarLuegoDeCrear).toHaveBeenCalledWith(true, expect.any(Function));
    expect(result.current.showCreateModal).toBe(false);
    expect(result.current.configSpeciesPlantacionId).toBeNull();

    // Recién al "cerrar el aviso" (invocar el callback capturado) se abre config de especies.
    const siguientePaso = mockContinuarLuegoDeCrear.mock.calls[0][1];
    act(() => { siguientePaso(); });

    expect(result.current.configSpeciesPlantacionId).toBe('dup-plantation-id');
  });

  it('no navega si handleCreateSubmit no devuelve id', async () => {
    mockHandleCreateSubmit.mockResolvedValue(undefined);
    const { result } = renderHook(() => usePlantacionesScreen());

    await act(async () => {
      await result.current.handleCreatePlantation({ lugar: 'Lote', periodo: '2026-A' } as any);
    });

    expect(result.current.configSpeciesPlantacionId).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('usePlantacionesScreen — sync confirm dialog', () => {
  it('modo global: showSyncConfirm abre el diálogo y handleSyncConfirm dispara startGlobalSync', () => {
    const { result } = renderHook(() => usePlantacionesScreen());

    act(() => result.current.showSyncConfirm('global'));
    expect(result.current.syncConfirmVisible).toBe(true);
    expect(result.current.syncConfirmMode).toBe('global');

    act(() => result.current.handleSyncConfirm(true));
    expect(result.current.syncConfirmVisible).toBe(false);
    expect(mockStartGlobalSync).toHaveBeenCalledWith(true);
    expect(mockStartPlantationSync).not.toHaveBeenCalled();
  });

  it('modo plantation: handleSyncConfirm dispara startPlantationSync con el id objetivo', () => {
    const { result } = renderHook(() => usePlantacionesScreen());

    act(() => result.current.showSyncConfirm('plantation', 'p1'));
    act(() => result.current.handleSyncConfirm(false));

    expect(mockStartPlantationSync).toHaveBeenCalledWith('p1', false);
    expect(mockStartGlobalSync).not.toHaveBeenCalled();
  });
});

describe('usePlantacionesScreen — expansión de card y bottom sheet', () => {
  it('handleToggleExpand alterna el id expandido', () => {
    const { result } = renderHook(() => usePlantacionesScreen());

    act(() => result.current.handleToggleExpand('p1'));
    expect(result.current.expandedPlantationId).toBe('p1');

    act(() => result.current.handleToggleExpand('p1'));
    expect(result.current.expandedPlantationId).toBeNull();
  });

  it('handleOpenGear carga el meta y abre el bottom sheet', async () => {
    mockFetchPlantationMeta.mockResolvedValue({ canFinalize: true, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0, pendientesSinSubir: '' });
    const { result } = renderHook(() => usePlantacionesScreen());
    const plantation = { id: 'p1', lugar: 'Lote 1' } as any;

    await act(async () => {
      await result.current.handleOpenGear(plantation);
    });

    expect(result.current.bottomSheetVisible).toBe(true);
    expect(result.current.bottomSheetPlantation).toEqual(plantation);
    expect(result.current.bottomSheetMeta.canFinalize).toBe(true);
  });

  it('onAssignTechFromSheet cierra el sheet y abre el modal de asignación, también sin conexión (#636)', async () => {
    const { result } = renderHook(() => usePlantacionesScreen());

    await act(async () => {
      await result.current.handleOpenGear({ id: 'p1' } as any);
    });
    await act(async () => {
      await result.current.onAssignTechFromSheet('p1');
    });

    expect(result.current.bottomSheetVisible).toBe(false);
    expect(result.current.assignTechPlantacionId).toBe('p1');
  });
});

describe('usePlantacionesScreen — sesión expirada durante sync', () => {
  it('handleSessionExpiredReauth resetea el sync y cierra sesión', () => {
    const { result } = renderHook(() => usePlantacionesScreen());

    act(() => result.current.handleSessionExpiredReauth());

    expect(mockResetSync).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
  });
});

describe('usePlantacionesScreen — edición de plantación finalizada (#469)', () => {
  const FINALIZADA = {
    id: 'p-fin', lugar: 'Finca Norte', periodo: '2026-A',
    estado: 'finalizada', createdAt: '2026-01-01',
  } as any;
  const ACTIVA = { ...FINALIZADA, id: 'p-act', estado: 'activa' };

  // Editar escribe lugar/período/config en `plantations`. La guarda va acá y no
  // en cada render porque son dos entradas: long-press de la card y el gear.
  it('no abre el modal de edición si la plantación está finalizada', () => {
    const { result } = renderHook(() => usePlantacionesScreen());

    act(() => result.current.handleEditPress(FINALIZADA));

    expect(result.current.editingPlantation).toBeNull();
  });

  it('sí lo abre si está activa', () => {
    const { result } = renderHook(() => usePlantacionesScreen());

    act(() => result.current.handleEditPress(ACTIVA));

    expect(result.current.editingPlantation).toEqual(ACTIVA);
  });
});
