import { useEffect, useState } from 'react';

/** Demora la propagación de un valor hasta que deja de cambiar por `retardoMs`. */
export function useDebounce<T>(valor: T, retardoMs: number): T {
  const [valorDemorado, setValorDemorado] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => setValorDemorado(valor), retardoMs);
    return () => clearTimeout(temporizador);
  }, [valor, retardoMs]);
  return valorDemorado;
}
