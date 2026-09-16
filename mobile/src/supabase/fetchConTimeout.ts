/**
 * `fetch` con timeout para todo lo que sale por el cliente de Supabase (#451).
 *
 * Inyectado una sola vez en `createClient`, cubre PostgREST, Storage y Auth
 * —incluidos `getSession`/`refreshSession`, los primeros candidatos a colgarse—
 * sin tocar un solo call site.
 *
 * El criterio es cortar la request que **no responde**, no la que tarda: una foto
 * de 4 MB con señal de campo puede tardar dos minutos legítimamente, y abortarla
 * rompe una subida que estaba funcionando justo donde más importa que funcione.
 */

export const TIMEOUT_MS = {
  /** Query o RPC de PostgREST, y las llamadas de auth. */
  query: 30_000,
  /** Subida o bajada de una foto por Storage. */
  foto: 120_000,
} as const;

/**
 * Marca en el mensaje del error. supabase-js envuelve lo que tira `fetch` en sus
 * propias clases (`AuthRetryableFetchError` y compañía) y lo único que conserva es
 * el `message`: sin la marca, un timeout llega indistinguible de un corte de red.
 */
export const MARCA_DE_TIMEOUT = 'SYNC_TIMEOUT';

export class TimeoutError extends Error {
  constructor(recurso: string, ms: number) {
    super(`${MARCA_DE_TIMEOUT}: sin respuesta en ${ms}ms — ${recurso}`);
    this.name = 'TimeoutError';
  }
}

/**
 * Vuelve a lanzar como excepción un timeout que supabase entregó adentro de
 * `{ error }`. Conserva el mensaje, que es lo que lleva la marca.
 */
export function errorDeTimeout(error: { message?: string } | null | undefined): Error {
  const e = new Error(String(error?.message ?? MARCA_DE_TIMEOUT));
  e.name = 'TimeoutError';
  return e;
}

/** ¿Este error es un timeout nuestro, envuelto o no? */
export function esTimeout(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  const mensaje = (error as { message?: unknown } | null)?.message;
  return typeof mensaje === 'string' && mensaje.includes(MARCA_DE_TIMEOUT);
}

/** Path sin query string: el mensaje va a los logs y los filtros no aportan nada. */
function recursoDe(input: RequestInfo | URL): string {
  const url = typeof input === 'string' ? input : String((input as Request).url ?? input);
  return url.split('?')[0];
}

/** Storage vive bajo /storage/v1/; PostgREST bajo /rest/v1/ y auth bajo /auth/v1/. */
function esTransferenciaDeFoto(recurso: string): boolean {
  return recurso.includes('/storage/v1/');
}

/**
 * Envuelve un `fetch`. El timeout se combina con el signal que traiga el caller
 * (`.abortSignal()` de postgrest, `{ signal }` de storage) para que la cancelación
 * del usuario siga funcionando y se distinga de un vencimiento.
 */
export function conTimeout(fetchBase: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const recurso = recursoDe(input);
    const ms = esTransferenciaDeFoto(recurso) ? TIMEOUT_MS.foto : TIMEOUT_MS.query;

    const control = new AbortController();
    let vencio = false;
    const reloj = setTimeout(() => {
      vencio = true;
      control.abort();
    }, ms);

    const externo = init?.signal;
    const propagar = () => control.abort();
    if (externo) {
      if (externo.aborted) control.abort();
      else externo.addEventListener('abort', propagar);
    }

    try {
      return await fetchBase(input, { ...init, signal: control.signal });
    } catch (e) {
      // El abort del caller gana: si canceló, no es un timeout aunque el reloj
      // haya llegado después.
      if (vencio && !externo?.aborted) throw new TimeoutError(recurso, ms);
      throw e;
    } finally {
      clearTimeout(reloj);
      externo?.removeEventListener('abort', propagar);
    }
  };
}
