import { useEffect, useState } from 'react';

import {
  hayActividadDeSync,
  subscribeActividadDeSync,
} from '../services/sync/syncActivityStore';

/** `true` mientras corre una sincronización o una descarga de catálogo (#446). */
export function useActividadDeSync(): boolean {
  const [activo, setActivo] = useState(hayActividadDeSync());

  useEffect(() => {
    const unsubscribe = subscribeActividadDeSync(setActivo);
    setActivo(hayActividadDeSync()); // sincroniza con lo que haya pasado antes de montar
    return unsubscribe;
  }, []);

  return activo;
}
