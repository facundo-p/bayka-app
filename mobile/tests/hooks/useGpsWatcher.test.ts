// Tests de useGpsWatcher: ciclo de vida de la suscripción y estados de permiso.

const mockRemove = jest.fn();
let capturedOnLocation: ((location: any) => void) | null = null;

jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
  Accuracy: { BestForNavigation: 1 },
  requestForegroundPermissionsAsync: jest.fn(),
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

import { useGpsWatcher } from '../../src/hooks/useGpsWatcher';

const requestPermission = Location.requestForegroundPermissionsAsync as jest.Mock;
const hasServices = Location.hasServicesEnabledAsync as jest.Mock;
const watchPosition = Location.watchPositionAsync as jest.Mock;

function mockLocation(latitude: number, longitude: number, accuracy: number | null) {
  return { coords: { latitude, longitude, accuracy }, timestamp: 1700000000000 };
}

describe('useGpsWatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnLocation = null;
    requestPermission.mockResolvedValue({ status: 'granted' });
    hasServices.mockResolvedValue(true);
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
});
