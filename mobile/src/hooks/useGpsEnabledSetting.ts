import { useEffect, useState } from 'react';

import {
  getGpsEnabled,
  hydrateGpsEnabled,
  setGpsEnabled,
  subscribeGpsEnabled,
} from '../services/settings/gpsEnabledStore';

/**
 * Preferencia local (por dispositivo) de medición de GPS in-app. Reactiva entre
 * pantallas: togglearla en Ajustes actualiza a todos los consumidores montados.
 */
export function useGpsEnabledSetting() {
  const [gpsEnabled, setLocal] = useState(getGpsEnabled());

  useEffect(() => {
    void hydrateGpsEnabled();
    const unsubscribe = subscribeGpsEnabled(setLocal);
    setLocal(getGpsEnabled()); // sincroniza con el último valor hidratado
    return unsubscribe;
  }, []);

  return { gpsEnabled, setGpsEnabled };
}
