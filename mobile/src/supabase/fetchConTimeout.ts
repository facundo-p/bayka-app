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
  /** Query o RPC puntual, y las llamadas de auth: si no contesta en 30s, no va a contestar. */
  query: 30_000,
  /**
   * Transferencia grande: una foto de 4 MB, o una página de 1000 filas.
   *
   * `fetch` en React Native va sobre XHR y resuelve recién con el cuerpo entero,
   * así que el reloj mide la transferencia completa, no el primer byte. Los 30s de
   * una query serían un presupuesto de descarga: una página de árboles pesa ~170 KB
   * comprimidos y con 5 kB/s —mala señal de campo, el escenario que importa— no
   * entra. Eso rompería una descarga que estaba avanzando bien.
   */
  transferencia: 120_000,
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

function urlDe(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : String((input as Request).url ?? input);
}

/**
 * Storage vive bajo /storage/v1/. Y `.range()` de postgrest —la paginación del
 * pull— se traduce en `offset`+`limit` en el query string: los dos juntos son su
 * firma, y distinguen una página de 1000 filas de un `.limit(1)` cualquiera.
 */
function esTransferenciaGrande(url: string): boolean {
  if (url.includes('/storage/v1/')) return true;
  return url.includes('offset=') && url.includes('limit=');
}

/**
 * Envuelve un `fetch`. El timeout se combina con el signal que traiga el caller
 * (`.abortSignal()` de postgrest, `{ signal }` de storage) para que la cancelación
 * del usuario siga funcionando y se distinga de un vencimiento.
 */
export function conTimeout(fetchBase: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const url = urlDe(input);
    // Sin el query string: el mensaje va a los logs y los filtros no aportan nada.
    const recurso = url.split('?')[0];
    const ms = esTransferenciaGrande(url) ? TIMEOUT_MS.transferencia : TIMEOUT_MS.query;

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
