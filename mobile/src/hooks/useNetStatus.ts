import NetInfo from '@react-native-community/netinfo';
import { useState, useEffect } from 'react';
import { estaConectado } from '../services/conexion';

/**
 * `isOnline` es false hasta que NetInfo responde. `conexionConocida` distingue ese
 * arranque de un "sin conexión" real, para no deshabilitar nada mientras tanto.
 */
export function useNetStatus() {
  const [conectado, setConectado] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => setConectado(estaConectado(state)));
    return unsubscribe;
  }, []);

  return { isOnline: conectado === true, conexionConocida: conectado !== null };
}
