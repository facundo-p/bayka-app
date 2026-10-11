import { useCallback, useRef, useState } from 'react';
import { useCerrarAfuera } from './useCerrarAfuera';

/**
 * Apertura de un panel que cuelga de su disparador, con los dos dentro de un
 * mismo contenedor: cierra al clickear fuera de él o con Escape.
 */
export function useDesplegableAnclado<T extends HTMLElement = HTMLDivElement>() {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<T>(null);
  const cerrar = useCallback(() => setAbierto(false), []);
  const alternar = useCallback(() => setAbierto((previo) => !previo), []);
  useCerrarAfuera(abierto, cerrar, contenedorRef);
  return { abierto, cerrar, alternar, contenedorRef };
}
