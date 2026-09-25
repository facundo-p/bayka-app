/**
 * Criterio de "hay conexión" de `useNetStatus` y de los técnicos (#636; el resto de la
 * app, #652): conectado y sin evidencia de que internet no responda
 * (`isInternetReachable` null cuenta como sí).
 */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export function estaConectado(estado: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  return estado.isConnected === true && estado.isInternetReachable !== false;
}

export async function hayConexion(): Promise<boolean> {
  return estaConectado(await NetInfo.fetch());
}
