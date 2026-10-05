import * as SecureStore from 'expo-secure-store';

type Opciones<T> = {
  clave: string;
  porDefecto: T;
  /** Clave anterior de la misma preferencia: se adopta su valor si la nueva no existe todavía. */
  claveAnterior?: string;
  leer: (guardado: string) => T;
  escribir: (valor: T) => string;
};

export type Preferencia<T> = {
  get: () => T;
  subscribe: (listener: (value: T) => void) => () => void;
  /** Lee el valor persistido una sola vez y, si hay uno, lo notifica. */
  hydrate: () => Promise<void>;
  set: (value: T) => Promise<void>;
  /** Solo para tests: resetea el singleton entre casos. */
  reset: () => void;
};

export type PreferenciaBooleana = Preferencia<boolean>;

/**
 * Preferencia local (por dispositivo) compartida entre pantallas: cambiarla en un
 * lugar se refleja en todos los consumidores montados.
 */
export function crearPreferencia<T>({ clave, porDefecto, claveAnterior, leer, escribir }: Opciones<T>): Preferencia<T> {
  let valor = porDefecto;
  let hidratada = false;
  let elegida = false;
  const listeners = new Set<(value: T) => void>();

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
      try {
        const guardado = await leerPersistido();
        // Lo que el usuario eligió mientras se leía le gana a lo guardado antes.
        if (guardado === null || elegida) return;
        valor = leer(guardado);
      } catch {
        return; // Sin acceso al almacenamiento, o con un valor ilegible, queda el default.
      }
      notificar();
    },
    async set(value) {
      elegida = true;
      valor = value;
      notificar();
      await SecureStore.setItemAsync(clave, escribir(value));
    },
    reset() {
      valor = porDefecto;
      hidratada = false;
      elegida = false;
      listeners.clear();
    },
  };
}

/** Una preferencia que no se guarda: el default mientras no hay de quién guardarla. */
export function preferenciaFija<T>(valor: T): Preferencia<T> {
  return {
    get: () => valor,
    subscribe: () => () => {},
    hydrate: async () => {},
    set: async () => {},
    reset: () => {},
  };
}

export function crearPreferenciaBooleana(opciones: Omit<Opciones<boolean>, 'leer' | 'escribir'>): PreferenciaBooleana {
  return crearPreferencia({ ...opciones, leer: (guardado) => guardado === 'true', escribir: String });
}
