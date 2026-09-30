import * as SecureStore from 'expo-secure-store';

type Opciones = {
  clave: string;
  porDefecto: boolean;
  /** Clave anterior de la misma preferencia: se adopta su valor si la nueva no existe todavía. */
  claveAnterior?: string;
};

export type PreferenciaBooleana = {
  get: () => boolean;
  subscribe: (listener: (value: boolean) => void) => () => void;
  /** Lee el valor persistido una sola vez y notifica si difiere del default. */
  hydrate: () => Promise<void>;
  set: (value: boolean) => Promise<void>;
  /** Solo para tests: resetea el singleton entre casos. */
  reset: () => void;
};

/**
 * Preferencia local (por dispositivo) compartida entre pantallas: cambiarla en un
 * lugar se refleja en todos los consumidores montados.
 */
export function crearPreferenciaBooleana({ clave, porDefecto, claveAnterior }: Opciones): PreferenciaBooleana {
  let valor = porDefecto;
  let hidratada = false;
  const listeners = new Set<(value: boolean) => void>();

  const notificar = () => listeners.forEach((notify) => notify(valor));

  async function leerPersistido(): Promise<string | null> {
    const guardado = await SecureStore.getItemAsync(clave);
    if (guardado !== null || !claveAnterior) return guardado;
    const anterior = await SecureStore.getItemAsync(claveAnterior);
    if (anterior === null) return null;
    await SecureStore.setItemAsync(clave, anterior);
    await SecureStore.deleteItemAsync(claveAnterior);
    return anterior;
  }

  return {
    get: () => valor,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async hydrate() {
      if (hidratada) return;
      hidratada = true;
      const guardado = await leerPersistido();
      if (guardado !== null) {
        valor = guardado === 'true';
        notificar();
      }
    },
    async set(value) {
      valor = value;
      notificar();
      await SecureStore.setItemAsync(clave, String(value));
    },
    reset() {
      valor = porDefecto;
      hidratada = false;
      listeners.clear();
    },
  };
}
