/**
 * Criterio único de conexión de la app (#652). Todo lo que decide "hay red" pasa por acá;
 * nadie lee `isConnected` / `isInternetReachable` a mano.
 *
 * - `estaConectado` / `hayConexion`: conexión confirmada (`isConnected` true y sin evidencia
 *   de que internet no responda; `isInternetReachable` null cuenta como sí). La usan la UI y
 *   las acciones que suben en el momento: ante la duda van al camino offline, que deja lo
 *   pendiente para el próximo sync.
 * - `sinRed`: no hay ninguna red. Es lo único que descarta el servidor sin intentarlo.
 * - `constaSinConexion`: sin red, o con red pero internet no confirmado. En Android
 *   `isInternetReachable` es false mientras valida una red nueva, con señal débil o en redes
 *   que bloquean el chequeo de Google, aunque Supabase responda. Por eso auth, en ese estado,
 *   prueba primero lo local pero no renuncia al servidor: el login offline va primero y, si
 *   no alcanza, se intenta online con timeout. Con `isConnected` null auth intenta online.
 */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

type EstadoDeRed = Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>;

export function estaConectado(estado: EstadoDeRed): boolean {
  return estado.isConnected === true && estado.isInternetReachable !== false;
}

export function sinRed(estado: EstadoDeRed): boolean {
  return estado.isConnected === false;
}

export function constaSinConexion(estado: EstadoDeRed): boolean {
  return sinRed(estado) || estado.isInternetReachable === false;
}

export async function hayConexion(): Promise<boolean> {
  return estaConectado(await NetInfo.fetch());
}
