/**
 * Un único criterio de "hay conexión" para la UI y los servicios: conectado y sin
 * evidencia de que internet no responda (`isInternetReachable` null cuenta como sí).
 */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export function estaConectado(estado: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  return estado.isConnected === true && estado.isInternetReachable !== false;
}

export async function hayConexion(): Promise<boolean> {
  return estaConectado(await NetInfo.fetch());
}
