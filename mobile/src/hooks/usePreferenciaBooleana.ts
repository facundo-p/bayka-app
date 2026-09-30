import { useEffect, useState } from 'react';

import type { PreferenciaBooleana } from '../services/settings/preferenciaBooleana';

/** Valor reactivo de una preferencia local: cambiarla en una pantalla actualiza a todas. */
export function usePreferenciaBooleana(preferencia: PreferenciaBooleana): boolean {
  const [valor, setValor] = useState(preferencia.get());

  useEffect(() => {
    void preferencia.hydrate();
    const unsubscribe = preferencia.subscribe(setValor);
    setValor(preferencia.get()); // sincroniza con el último valor hidratado
    return unsubscribe;
  }, [preferencia]);

  return valor;
}
