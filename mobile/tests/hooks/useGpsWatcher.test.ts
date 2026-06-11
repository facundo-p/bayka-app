// Tests de useGpsWatcher: ciclo de vida de la suscripción, estados de permiso
// y crash-safety (prompt único + no reiniciar watcher activo en resume — bug #115).

const mockRemove = jest.fn();
let capturedOnLocation: ((location: any) => void) | null = null;

jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
  Accuracy: { BestForNavigation: 1 },
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  watchPositionAsync: jest.fn(async (_options: any, onLocation: (location: any) => void) => {
    capturedOnLocation = onLocation;
    return { remove: mockRemove };
  }),
}));

// useFocusEffect se comporta como useEffect (pantalla siempre enfocada en el test).
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => (() => void) | void) => {
    const React = require('react');
    React.useEffect(callback, [callback]);
  },
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { AppState } from 'react-native';

import { useGpsWatcher } from '../../src/hooks/useGpsWatcher';

const requestPermission = Location.requestForegroundPermissionsAsync as jest.Mock;
const getPermission = Location.getForegroundPermissionsAsync as jest.Mock;
const hasServices = Location.hasServicesEnabledAsync as jest.Mock;
const watchPosition = Location.watchPositionAsync as jest.Mock;

let appStateCb: ((state: string) => void) | null = null;

function mockLocation(latitude: number, longitude: number, accuracy: number | null) {
  return { coords: { latitude, longitude, accuracy }, timestamp: 1700000000000 };
}

describe('useGpsWatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnLocation = null;
    appStateCb = null;
    requestPermission.mockResolvedValue({ status: 'granted' });
    getPermission.mockResolvedValue({ status: 'granted' });
    hasServices.mockResolvedValue(true);
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, cb: any) => {
      appStateCb = cb;
      return { remove: jest.fn() };
    }) as any);
  });

  afterEach(() => {
    (AppState.addEventListener as jest.Mock).mockRestore();
  });

  it('con permiso otorgado arranca el watcher y entrega fixes', async () => {
    const { result } = renderHook(() => useGpsWatcher());

    await waitFor(() => expect(result.current.permissionStatus).toBe('otorgado'));
    expect(watchPosition).toHaveBeenCalledTimes(1);

    act(() => {
      capturedOnLocation!(mockLocation(-31.5, -60.7, 4.2));
    });
    expect(result.current.lastFix).toEqual({
      latitude: -31.5,
      longitude: -60.7,
      accuracy: 4.2,
      timestamp: 1700000000000,
    });
  });

  it('normaliza accuracy ausente a null', async () => {
    const { result } = renderHook(() => useGpsWatcher());
    await waitFor(() => expect(result.current.permissionStatus).toBe('otorgado'));

    act(() => {
      capturedOnLocation!(mockLocation(-31.5, -60.7, null));
    });
    expect(result.current.lastFix?.accuracy).toBeNull();
  });

  it('con permiso denegado expone el estado y NO arranca el watcher', async () => {
    requestPermission.mockResolvedValue({ status: 'denied' });
    const { result } = renderHook(() => useGpsWatcher());

    await waitFor(() => expect(result.current.permissionStatus).toBe('denegado'));
    expect(watchPosition).not.toHaveBeenCalled();
    expect(result.current.lastFix).toBeNull();
  });

  it('con GPS del dispositivo apagado expone servicesEnabled=false y no arranca', async () => {
    hasServices.mockResolvedValue(false);
    const { result } = renderHook(() => useGpsWatcher());

    await waitFor(() => expect(result.current.servicesEnabled).toBe(false));
    expect(watchPosition).not.toHaveBeenCalled();
  });

  it('al desmontar detiene la suscripción', async () => {
    const { result, unmount } = renderHook(() => useGpsWatcher());
    await waitFor(() => expect(result.current.permissionStatus).toBe('otorgado'));
    await waitFor(() => expect(watchPosition).toHaveBeenCalled());

    unmount();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('si el permiso falla con excepción no rompe el render', async () => {
    requestPermission.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useGpsWatcher());

    // Estado inicial estable; el error queda logueado, no lanzado.
    await act(async () => {});
    expect(result.current.permissionStatus).toBe('pendiente');
    expect(result.current.lastFix).toBeNull();
  });

  // ─── Crash-safety (#115) ────────────────────────────────────────────────────

  it('el diálogo de permiso se pide UNA sola vez; en resume re-chequea SIN diálogo', async () => {
    const { result } = renderHook(() => useGpsWatcher());
    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));
    expect(requestPermission).toHaveBeenCalledTimes(1);

    // Simula volver del background (la causa del titileo/crash en ráfaga).
    await act(async () => {
      appStateCb?.('active');
    });

    // No re-pide el permiso con diálogo y NO reinicia el watcher ya activo.
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(getPermission).toHaveBeenCalled();
    expect(watchPosition).toHaveBeenCalledTimes(1);
    expect(mockRemove).not.toHaveBeenCalled();
    expect(result.current.permissionStatus).toBe('otorgado');
  });

  it('resume tras habilitar permiso/GPS arranca el watcher sin re-promptear', async () => {
    requestPermission.mockResolvedValue({ status: 'denied' });
    getPermission.mockResolvedValue({ status: 'denied' });
    hasServices.mockResolvedValue(false);
    const { result } = renderHook(() => useGpsWatcher());

    await waitFor(() => expect(result.current.servicesEnabled).toBe(false));
    expect(watchPosition).not.toHaveBeenCalled();

    // El usuario otorgó permiso y encendió el GPS desde Ajustes y volvió.
    getPermission.mockResolvedValue({ status: 'granted' });
    hasServices.mockResolvedValue(true);
    await act(async () => {
      appStateCb?.('active');
    });

    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));
    expect(requestPermission).toHaveBeenCalledTimes(1); // nunca se re-prompteó
  });
});
