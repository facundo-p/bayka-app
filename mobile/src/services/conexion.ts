/**
 * Criterio único de conexión de la app (#652). Todo lo que decide "hay red" pasa por acá;
 * nadie lee `isConnected` / `isInternetReachable` a mano.
 *
 * Mismo criterio, dos lecturas según qué cuesta equivocarse:
 * - `estaConectado` / `hayConexion`: conexión confirmada (`isConnected` true y sin evidencia
 *   de que internet no responda; `isInternetReachable` null cuenta como sí). Es la que usan
 *   la UI y las acciones que suben en el momento: ante la duda van al camino offline, que
 *   deja lo pendiente para el próximo sync.
 * - `constaSinConexion`: NetInfo afirma que no hay red o que internet no responde. Solo
 *   para auth: con estado desconocido (`isConnected` null) el login y el auto-refresh
 *   intentan online, y el login cae al camino offline por timeout. Tratar el null como
 *   "sin conexión" ahí dejaría sin entrar a quien tiene red y no tiene credencial cacheada.
 */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

type EstadoDeRed = Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>;

export function estaConectado(estado: EstadoDeRed): boolean {
  return estado.isConnected === true && estado.isInternetReachable !== false;
}

export function constaSinConexion(estado: EstadoDeRed): boolean {
  return estado.isConnected === false || estado.isInternetReachable === false;
}

export async function hayConexion(): Promise<boolean> {
  return estaConectado(await NetInfo.fetch());
}
