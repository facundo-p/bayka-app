import { useEffect, useState } from 'react';

import type { Preferencia } from '../services/settings/preferencia';

/** Valor reactivo de una preferencia local: cambiarla en una pantalla actualiza a todas. */
export function usePreferencia<T>(preferencia: Preferencia<T>): T {
  const [valor, setValor] = useState(preferencia.get());

  useEffect(() => {
    void preferencia.hydrate();
    const unsubscribe = preferencia.subscribe(setValor);
    setValor(preferencia.get()); // sincroniza con el último valor hidratado
    return unsubscribe;
  }, [preferencia]);

  return valor;
}
