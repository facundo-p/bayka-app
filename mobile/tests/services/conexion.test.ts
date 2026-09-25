jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { fetch: jest.fn() } }));

import NetInfo from '@react-native-community/netinfo';
import { constaSinConexion, estaConectado, hayConexion } from '../../src/services/conexion';

describe('estaConectado', () => {
  it.each([
    [{ isConnected: true, isInternetReachable: true }, true],
    [{ isConnected: true, isInternetReachable: null }, true],
    [{ isConnected: true, isInternetReachable: false }, false],
    [{ isConnected: false, isInternetReachable: null }, false],
    [{ isConnected: null, isInternetReachable: null }, false],
  ])('%o → %s', (estado, esperado) => {
    expect(estaConectado(estado as any)).toBe(esperado);
  });
});

describe('constaSinConexion', () => {
  it.each([
    [{ isConnected: true, isInternetReachable: true }, false],
    [{ isConnected: true, isInternetReachable: null }, false],
    [{ isConnected: null, isInternetReachable: null }, false],
    [{ isConnected: true, isInternetReachable: false }, true],
    [{ isConnected: false, isInternetReachable: null }, true],
  ])('%o → %s', (estado, esperado) => {
    expect(constaSinConexion(estado as any)).toBe(esperado);
  });
});

describe('hayConexion', () => {
  it('usa el mismo criterio sobre NetInfo.fetch', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true, isInternetReachable: false });
    expect(await hayConexion()).toBe(false);
  });
});
