/** Señal que aborta pasado un tiempo, y cómo soltar su timer si se terminó antes. */
export type SenalConEspera = { senal: AbortSignal; liberar: () => void };

const TIENE_TIMEOUT_NATIVO = typeof AbortSignal.timeout === 'function';

/**
 * `AbortSignal.timeout` donde existe; antes de Safari 16, un controlador con su
 * timer. Abortada por espera, `senal.aborted` queda en true.
 */
export function senalConEspera(ms: number, nativo = TIENE_TIMEOUT_NATIVO): SenalConEspera {
  if (nativo) return { senal: AbortSignal.timeout(ms), liberar: () => {} };
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), ms);
  return { senal: controlador.signal, liberar: () => clearTimeout(timer) };
}
