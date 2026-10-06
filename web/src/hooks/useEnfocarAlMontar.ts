import { useEffect, useRef } from 'react';

/** Ref que recibe el foco al montarse el elemento, si `enfocar` es true en ese momento. */
export function useEnfocarAlMontar<T extends HTMLElement>(enfocar: boolean) {
  const ref = useRef<T>(null);
  const enfocarInicial = useRef(enfocar);
  useEffect(() => {
    if (enfocarInicial.current) ref.current?.focus();
  }, []);
  return ref;
}
