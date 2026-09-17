import { useSyncExternalStore } from 'react';
import { addUpdatesStateChangeListener, latestContext } from 'expo-updates';

/**
 * `true` cuando hay un OTA descargado esperando el reinicio (#460).
 *
 * No usa `useUpdates`: toma el estado en el render y se suscribe en un efecto sin
 * releerlo, así que un update que termina en ese hueco no llega nunca a la
 * pantalla. `useSyncExternalStore` relee el estado al suscribirse.
 */
export function useActualizacionPendiente(): boolean {
  return useSyncExternalStore(suscribir, leerPendiente);
}

function suscribir(avisar: () => void): () => void {
  const suscripcion = addUpdatesStateChangeListener(avisar);
  return () => suscripcion.remove();
}

function leerPendiente(): boolean {
  return Boolean(latestContext.isUpdatePending);
}
