import * as SecureStore from 'expo-secure-store';

const GPS_ENABLED_KEY = 'gps_enabled_in_app';

// Fuente de verdad compartida entre pantallas (Ajustes y el registro de árboles):
// togglear la medición de GPS en un lugar se refleja en todos los consumidores.
let cachedEnabled = true; // default: medición de GPS habilitada
let hydrated = false;
const listeners = new Set<(value: boolean) => void>();

export function getGpsEnabled(): boolean {
  return cachedEnabled;
}

export function subscribeGpsEnabled(listener: (value: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Lee la preferencia persistida una sola vez y notifica si difiere del default. */
export async function hydrateGpsEnabled(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  const stored = await SecureStore.getItemAsync(GPS_ENABLED_KEY);
  if (stored !== null) {
    cachedEnabled = stored === 'true';
    listeners.forEach((notify) => notify(cachedEnabled));
  }
}

export async function setGpsEnabled(value: boolean): Promise<void> {
  cachedEnabled = value;
  listeners.forEach((notify) => notify(value));
  await SecureStore.setItemAsync(GPS_ENABLED_KEY, String(value));
}

/** Solo para tests: resetea el singleton entre casos. */
export function __resetGpsEnabledStore(): void {
  cachedEnabled = true;
  hydrated = false;
  listeners.clear();
}
