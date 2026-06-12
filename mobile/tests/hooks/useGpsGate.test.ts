// Tests del hook de gating: estados y los tres caminos de desbloqueo.

const mockOpenGpsUnblockDialog = jest.fn();
const mockSetGpsEnabled = jest.fn();

jest.mock('../../src/services/gps/locationClient', () => ({
  openGpsUnblockDialog: (...args: any[]) => mockOpenGpsUnblockDialog(...args),
}));

jest.mock('../../src/services/settings/gpsEnabledStore', () => ({
  setGpsEnabled: (...args: any[]) => mockSetGpsEnabled(...args),
}));

jest.mock('../../src/utils/gpsLogger', () => ({
  gpsLog: { info: jest.fn(), error: jest.fn() },
}));

import { act, renderHook } from '@testing-library/react-native';

import { useGpsGate, UseGpsGateParams } from '../../src/hooks/useGpsGate';

function params(overrides: Partial<UseGpsGateParams> = {}): UseGpsGateParams {
  return {
    required: true,
    gpsEnabled: true,
    permissionStatus: 'otorgado',
    servicesEnabled: true,
    refreshWatcher: jest.fn(),
    ...overrides,
  };
}

describe('useGpsGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenGpsUnblockDialog.mockResolvedValue(undefined);
    mockSetGpsEnabled.mockResolvedValue(undefined);
  });

  it('GPS operativo: habilitada sin mensaje', () => {
    const { result } = renderHook(() => useGpsGate(params()));
    expect(result.current.blocked).toBe(false);
    expect(result.current.message).toBeNull();
  });

  it('medición desactivada: bloqueada; el desbloqueo activa la medición (no abre diálogo del SO)', async () => {
    const p = params({ gpsEnabled: false });
    const { result } = renderHook(() => useGpsGate(p));
    expect(result.current.blocked).toBe(true);
    expect(result.current.message).toMatch(/medición/);

    await act(async () => {
      await result.current.requestUnblock();
    });
    expect(mockSetGpsEnabled).toHaveBeenCalledWith(true);
    expect(mockOpenGpsUnblockDialog).not.toHaveBeenCalled();
    expect(p.refreshWatcher).toHaveBeenCalled();
  });

  it('permiso denegado: bloqueada con mensaje; el desbloqueo pide permiso y re-chequea', async () => {
    const p = params({ permissionStatus: 'denegado' });
    const { result } = renderHook(() => useGpsGate(p));
    expect(result.current.blocked).toBe(true);
    expect(result.current.message).toMatch(/permiso/);

    await act(async () => {
      await result.current.requestUnblock();
    });
    expect(mockOpenGpsUnblockDialog).toHaveBeenCalledWith('permiso');
    expect(p.refreshWatcher).toHaveBeenCalled();
  });

  it('GPS apagado: bloqueada; el desbloqueo dispara el diálogo de activación', async () => {
    const p = params({ servicesEnabled: false });
    const { result } = renderHook(() => useGpsGate(p));
    expect(result.current.blocked).toBe(true);

    await act(async () => {
      await result.current.requestUnblock();
    });
    expect(mockOpenGpsUnblockDialog).toHaveBeenCalledWith('gps-apagado');
    expect(p.refreshWatcher).toHaveBeenCalled();
  });

  it('captura no obligatoria: nunca bloquea y el desbloqueo es no-op', async () => {
    const p = params({ required: false, permissionStatus: 'denegado', servicesEnabled: false });
    const { result } = renderHook(() => useGpsGate(p));
    expect(result.current.blocked).toBe(false);

    await act(async () => {
      await result.current.requestUnblock();
    });
    expect(mockOpenGpsUnblockDialog).not.toHaveBeenCalled();
  });

  it('cambio de obligatoriedad por pull con la pantalla abierta re-evalúa el bloqueo', () => {
    let currentParams = params({ required: true, permissionStatus: 'denegado' });
    const { result, rerender } = renderHook(() => useGpsGate(currentParams));
    expect(result.current.blocked).toBe(true);

    currentParams = params({ required: false, permissionStatus: 'denegado' });
    rerender(undefined as never);
    expect(result.current.blocked).toBe(false);
  });

  it('el diálogo que falla no rompe: loguea y libera el estado unblocking', async () => {
    mockOpenGpsUnblockDialog.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useGpsGate(params({ permissionStatus: 'denegado' })));

    await act(async () => {
      await result.current.requestUnblock();
    });
    expect(result.current.unblocking).toBe(false);
  });
});
