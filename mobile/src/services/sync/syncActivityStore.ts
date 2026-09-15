/**
 * Marca global de "hay sincronización o descarga en curso" (#446). La consume el
 * banner de actualización OTA para no ofrecer un reinicio de la app en medio de
 * una escritura a la base o una subida de fotos.
 *
 * Es un contador y no un booleano: nada impide que dos corridas se solapen, y con
 * un booleano la primera en terminar apagaría la marca mientras la otra sigue.
 *
 * Vive en el borde de los orquestadores (`syncPlantation`, `syncAllPlantations`,
 * `batchDownload`) y no en `useSync`, porque la descarga de catálogo corre por
 * otra máquina de estados y desde el hook quedaría afuera.
 */
let corridasActivas = 0;
const listeners = new Set<(activo: boolean) => void>();

function notificar(): void {
  const activo = corridasActivas > 0;
  listeners.forEach((listener) => listener(activo));
}

export function hayActividadDeSync(): boolean {
  return corridasActivas > 0;
}

export function subscribeActividadDeSync(listener: (activo: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Decora un orquestador para que marque actividad mientras corre. El decremento
 * va en `finally` para que un error —incluida una cancelación— no deje la marca
 * encendida para siempre.
 */
export function marcandoActividadDeSync<A extends unknown[], R>(
  orquestador: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    corridasActivas++;
    if (corridasActivas === 1) notificar();
    try {
      return await orquestador(...args);
    } finally {
      corridasActivas--;
      if (corridasActivas === 0) notificar();
    }
  };
}

/** Solo para tests: resetea el singleton entre casos. */
export function __resetActividadDeSync(): void {
  corridasActivas = 0;
  listeners.clear();
}
