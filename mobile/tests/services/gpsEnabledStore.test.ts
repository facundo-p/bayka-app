// Tests del store de preferencia de medición de GPS (singleton + SecureStore).
import * as SecureStore from 'expo-secure-store';

import {
  __resetGpsEnabledStore,
  getGpsEnabled,
  hydrateGpsEnabled,
  setGpsEnabled,
  subscribeGpsEnabled,
} from '../../src/services/settings/gpsEnabledStore';

const GPS_ENABLED_KEY = 'gps_enabled_in_app';

describe('gpsEnabledStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetGpsEnabledStore();
  });

  it('por defecto la medición de GPS está habilitada', () => {
    expect(getGpsEnabled()).toBe(true);
  });

  it('hidrata desde SecureStore cuando hay un valor guardado (false)', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('false');
    await hydrateGpsEnabled();
    expect(getGpsEnabled()).toBe(false);
  });

  it('hidrata una sola vez (la segunda llamada no vuelve a leer)', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('false');
    await hydrateGpsEnabled();
    await hydrateGpsEnabled();
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
  });

  it('setGpsEnabled persiste el valor como string en SecureStore', async () => {
    await setGpsEnabled(false);
    expect(getGpsEnabled()).toBe(false);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(GPS_ENABLED_KEY, 'false');
  });

  it('notifica a los suscriptores cuando cambia el valor', async () => {
    const listener = jest.fn();
    subscribeGpsEnabled(listener);
    await setGpsEnabled(false);
    expect(listener).toHaveBeenCalledWith(false);
  });

  it('un suscriptor desuscripto ya no recibe cambios', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeGpsEnabled(listener);
    unsubscribe();
    await setGpsEnabled(false);
    expect(listener).not.toHaveBeenCalled();
  });
});
