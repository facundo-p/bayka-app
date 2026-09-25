import NetInfo from '@react-native-community/netinfo';

export function setOffline(): void {
  (NetInfo.fetch as jest.Mock).mockResolvedValue({
    isConnected: false,
    isInternetReachable: false,
  });
}

export function setOnline(): void {
  (NetInfo.fetch as jest.Mock).mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  });
}

export const SIN_INTERNET = { isConnected: true, isInternetReachable: false };
export const RED_DESCONOCIDA = { isConnected: null, isInternetReachable: null };

/** Conectado a una red sin salida a internet (wifi sin datos, portal cautivo). */
export function setSinInternet(): void {
  (NetInfo.fetch as jest.Mock).mockResolvedValue(SIN_INTERNET);
}

/** NetInfo todavía no sabe si hay red. */
export function setRedDesconocida(): void {
  (NetInfo.fetch as jest.Mock).mockResolvedValue(RED_DESCONOCIDA);
}
