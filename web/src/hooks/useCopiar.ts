import { useEffect, useState } from 'react';

/** Cuánto dura la confirmación «Copiado» antes de volver al ícono de copiar. */
export const MS_CONFIRMACION_COPIADO = 1500;

/**
 * Copia texto al portapapeles y marca `copiado` un momento. Si el navegador lo
 * niega (sin permiso o sin contexto seguro) no hay confirmación: el usuario ve
 * que no cambió y puede seleccionar el texto a mano.
 */
export function useCopiar() {
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!copiado) return;
    const temporizador = setTimeout(() => setCopiado(false), MS_CONFIRMACION_COPIADO);
    return () => clearTimeout(temporizador);
  }, [copiado]);
  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }
  return { copiado, copiar };
}
