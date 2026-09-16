import { conTimeout, esTimeout, errorDeTimeout, MARCA_DE_TIMEOUT, TIMEOUT_MS, TimeoutError } from '../../src/supabase/fetchConTimeout';

const URL_QUERY = 'https://proyecto.supabase.co/rest/v1/trees?select=*&group_id=in.(a,b)';
/** `.range()` de postgrest: offset+limit en el query string. */
const URL_PAGINA = 'https://proyecto.supabase.co/rest/v1/trees?select=*&offset=0&limit=1000';
const URL_FOTO = 'https://proyecto.supabase.co/storage/v1/object/tree-photos/plantations/p/t.jpg';

/**
 * Doble de `fetch` que nunca contesta y solo termina cuando lo abortan. Rechaza de
 * entrada si el signal ya venía abortado, como hace el real: sin eso el doble no
 * puede ver el caso de la cancelación que llega antes que la request.
 */
function fetchQueNoResponde(): typeof fetch {
  return ((_input: unknown, init?: RequestInit) =>
    new Promise((_resolver, rechazar) => {
      const abortar = () => {
        const e = new Error('Aborted');
        e.name = 'AbortError';
        rechazar(e);
      };
      if (init?.signal?.aborted) return abortar();
      init?.signal?.addEventListener('abort', abortar);
    })) as unknown as typeof fetch;
}

/** ¿La promesa sigue pendiente? Hay que dejar correr los microtasks primero. */
async function sigueEsperando(p: Promise<unknown>): Promise<boolean> {
  let resuelta = false;
  p.then(() => { resuelta = true; }, () => { resuelta = true; });
  await Promise.resolve();
  await Promise.resolve();
  return !resuelta;
}

describe('conTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('devuelve la respuesta cuando el fetch contesta', async () => {
    const respuesta = { ok: true } as Response;
    const envuelto = conTimeout(jest.fn().mockResolvedValue(respuesta) as unknown as typeof fetch);

    await expect(envuelto(URL_QUERY)).resolves.toBe(respuesta);
  });

  it('corta una query que no responde y lo marca como timeout', async () => {
    const envuelto = conTimeout(fetchQueNoResponde());
    const pedido = envuelto(URL_QUERY);
    const afirmacion = expect(pedido).rejects.toThrow(MARCA_DE_TIMEOUT);

    jest.advanceTimersByTime(TIMEOUT_MS.query);

    await afirmacion;
  });

  // Una foto de 4 MB con señal de campo tarda minutos legítimamente: cortarla a
  // los 30s rompe una subida que estaba funcionando.
  it('a una transferencia de Storage le da el timeout largo, no el de query', async () => {
    const envuelto = conTimeout(fetchQueNoResponde());
    const pedido = envuelto(URL_FOTO);
    const afirmacion = expect(pedido).rejects.toThrow(MARCA_DE_TIMEOUT);

    jest.advanceTimersByTime(TIMEOUT_MS.query);
    expect(await sigueEsperando(pedido)).toBe(true);

    jest.advanceTimersByTime(TIMEOUT_MS.transferencia - TIMEOUT_MS.query);
    await afirmacion;
  });

  /**
   * `fetch` en React Native resuelve recién con el cuerpo entero, así que el reloj
   * de una página de 1000 filas es un presupuesto de descarga, no de espera. Con 30s
   * una descarga que estaba avanzando bien con mala señal se rompería.
   */
  it('a una página paginada le da el timeout largo, no el de query', async () => {
    const envuelto = conTimeout(fetchQueNoResponde());
    const pedido = envuelto(URL_PAGINA);
    const afirmacion = expect(pedido).rejects.toThrow(MARCA_DE_TIMEOUT);

    jest.advanceTimersByTime(TIMEOUT_MS.query);
    expect(await sigueEsperando(pedido)).toBe(true);

    jest.advanceTimersByTime(TIMEOUT_MS.transferencia - TIMEOUT_MS.query);
    await afirmacion;
  });

  // Un `.limit(1)` suelto (checkFreshness) es una query, no una transferencia.
  it('un limit sin offset sigue siendo una query', async () => {
    const envuelto = conTimeout(fetchQueNoResponde());
    const pedido = envuelto('https://proyecto.supabase.co/rest/v1/groups?select=created_at&limit=1');
    const afirmacion = expect(pedido).rejects.toThrow(MARCA_DE_TIMEOUT);

    jest.advanceTimersByTime(TIMEOUT_MS.query);

    await afirmacion;
  });

  it('un error de red pasa tal cual: no se disfraza de timeout', async () => {
    const red = new Error('Network request failed');
    const envuelto = conTimeout(jest.fn().mockRejectedValue(red) as unknown as typeof fetch);

    await expect(envuelto(URL_QUERY)).rejects.toBe(red);
  });

  // El usuario que cancela no está sufriendo un timeout: mezclarlos le muestra un
  // error de servidor por algo que pidió él.
  it('si el caller aborta, el error no se reporta como timeout', async () => {
    const control = new AbortController();
    const envuelto = conTimeout(fetchQueNoResponde());
    const pedido = envuelto(URL_QUERY, { signal: control.signal });

    control.abort();
    jest.advanceTimersByTime(TIMEOUT_MS.query);

    await expect(pedido).rejects.toThrow('Aborted');
  });

  it('un signal ya abortado corta de entrada', async () => {
    const control = new AbortController();
    control.abort();
    const envuelto = conTimeout(fetchQueNoResponde());

    await expect(envuelto(URL_QUERY, { signal: control.signal })).rejects.toThrow('Aborted');
  });

  // Un reloj que queda vivo mantiene despierto el timer del runtime por cada
  // request del sync.
  it('limpia el reloj cuando la respuesta llega', async () => {
    const envuelto = conTimeout(jest.fn().mockResolvedValue({} as Response) as unknown as typeof fetch);

    await envuelto(URL_QUERY);

    expect(jest.getTimerCount()).toBe(0);
  });

  // El mensaje va a los logs; los filtros no aportan nada y ensucian.
  it('el mensaje nombra el recurso sin el query string', async () => {
    const envuelto = conTimeout(fetchQueNoResponde());
    const mensaje = envuelto(URL_QUERY).catch((e) => (e as Error).message);

    jest.advanceTimersByTime(TIMEOUT_MS.query);

    await expect(mensaje).resolves.toContain('/rest/v1/trees');
    await expect(mensaje).resolves.not.toContain('group_id');
  });
});

describe('esTimeout', () => {
  it('reconoce el error propio', () => {
    expect(esTimeout(new TimeoutError('/rest/v1/trees', TIMEOUT_MS.query))).toBe(true);
  });

  // supabase-js envuelve lo que tira fetch en sus propias clases y solo conserva
  // el mensaje: sin la marca, un timeout llega indistinguible de un corte de red.
  it('reconoce el error envuelto por supabase, que solo conserva el mensaje', () => {
    expect(esTimeout({ message: `AuthRetryableFetchError: ${MARCA_DE_TIMEOUT}: sin respuesta en 30000ms — /auth/v1/token` })).toBe(true);
  });

  it('no confunde un error de red con un timeout', () => {
    expect(esTimeout(new Error('Network request failed'))).toBe(false);
    expect(esTimeout({ code: 'PGRST116', message: 'no rows' })).toBe(false);
    expect(esTimeout(null)).toBe(false);
    expect(esTimeout(undefined)).toBe(false);
  });
});

describe('errorDeTimeout', () => {
  it('convierte en excepción el timeout que supabase devolvió dentro de { error }', () => {
    const devuelto = { message: `${MARCA_DE_TIMEOUT}: sin respuesta en 30000ms — /rest/v1/trees` };

    const e = errorDeTimeout(devuelto);

    expect(e.name).toBe('TimeoutError');
    expect(esTimeout(e)).toBe(true);
  });
});
