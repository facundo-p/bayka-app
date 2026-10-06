import { useEffect, useRef } from 'react';

/**
 * Ref que recibe el foco al montarse el elemento, si `enfocar` es true en ese
 * momento. `alEnfocar` avisa para que quien lo pidió baje el pedido: si no, un
 * remonte posterior volvería a robar el foco.
 */
export function useEnfocarAlMontar<T extends HTMLElement>(
  enfocar: boolean,
  alEnfocar?: () => void,
) {
  const ref = useRef<T>(null);
  const pedido = useRef({ enfocar, alEnfocar });
  useEffect(() => {
    if (!pedido.current.enfocar) return;
    ref.current?.focus();
    pedido.current.alEnfocar?.();
  }, []);
  return ref;
}
