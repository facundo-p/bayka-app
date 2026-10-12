import type { ArchivosFuentes } from '../../plantilla/fuentes';
import { atenderPedido, type PedidoRender, type RespuestaRender } from '../renderReporte';
import { renderizarEnWorker, type CrearWorker } from '../renderizarEnWorker';

const PEDIDO: PedidoRender = {
  documento: {
    encabezado: { logo: '/logo.png', titulo: 'San Sebastián · 2025-2026', detalle: 'SS26' },
    emitido: '12/10/2026',
    reparto: { tarjetas: [], listado: [] },
  },
  fuentes: {} as ArchivosFuentes,
};
const BLOB = new Blob(['%PDF']);
const FALLA_AL_CARGAR = Symbol('falla al cargar');
const ILEGIBLE = Symbol('respuesta que no se puede deserializar');
const NO_CONTESTA = Symbol('sigue armando');
const NO_SE_PUEDE_CLONAR = Symbol('el pedido no cruza al worker');

type Salida =
  | RespuestaRender
  | typeof FALLA_AL_CARGAR
  | typeof ILEGIBLE
  | typeof NO_CONTESTA
  | typeof NO_SE_PUEDE_CLONAR;

/** Un worker que contesta lo que se le diga, falla, se queda armando o rechaza el pedido. */
function workerFalso(contestar: (pedido: PedidoRender) => Salida) {
  const worker = {
    onmessage: null as ((evento: MessageEvent) => void) | null,
    onerror: null as ((evento: ErrorEvent) => void) | null,
    onmessageerror: null as ((evento: MessageEvent) => void) | null,
    postMessage: vi.fn((pedido: PedidoRender) => {
      const salida = contestar(pedido);
      if (salida === NO_SE_PUEDE_CLONAR) {
        throw new DOMException('could not be cloned', 'DataCloneError');
      }
      queueMicrotask(() => {
        if (salida === NO_CONTESTA) return;
        if (salida === FALLA_AL_CARGAR) {
          worker.onerror?.(new ErrorEvent('error', { message: 'window is not defined' }));
        } else if (salida === ILEGIBLE) worker.onmessageerror?.(new MessageEvent('messageerror'));
        else worker.onmessage?.(new MessageEvent('message', { data: salida }));
      });
    }),
    terminate: vi.fn(),
  };
  return worker;
}

const crearCon =
  (worker: ReturnType<typeof workerFalso>): CrearWorker =>
  () =>
    worker as unknown as ReturnType<CrearWorker>;

/** Los rechazos que nadie escuchó mientras corre `hacer`. */
async function rechazosSueltos(hacer: () => Promise<void>): Promise<unknown[]> {
  const rechazos: unknown[] = [];
  const anotar = (razon: unknown) => rechazos.push(razon);
  process.on('unhandledRejection', anotar);
  try {
    await hacer();
    await new Promise((listo) => setTimeout(listo, 0));
  } finally {
    process.off('unhandledRejection', anotar);
  }
  return rechazos;
}

describe('renderizarEnWorker', () => {
  test('le manda el pedido al worker, devuelve su PDF y lo termina', async () => {
    const worker = workerFalso(() => ({ blob: BLOB }));
    await expect(renderizarEnWorker(PEDIDO, { crear: crearCon(worker) })).resolves.toBe(BLOB);
    expect(worker.postMessage).toHaveBeenCalledWith(PEDIDO);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  test('si el render falla, rechaza con su mensaje y también lo termina', async () => {
    const worker = workerFalso(() => ({ error: 'fuente rota' }));
    await expect(renderizarEnWorker(PEDIDO, { crear: crearCon(worker) })).rejects.toThrow(
      'fuente rota',
    );
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  test.each([
    ['no llega a cargar', FALLA_AL_CARGAR, 'window is not defined'],
    ['contesta algo ilegible', ILEGIBLE, 'No se pudo leer el PDF'],
  ] as const)('si el worker %s, rechaza en vez de quedar esperando', async (_, salida, mensaje) => {
    const worker = workerFalso(() => salida);
    await expect(renderizarEnWorker(PEDIDO, { crear: crearCon(worker) })).rejects.toThrow(mensaje);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  test('cancelado a mitad del armado, termina el worker y rechaza como cancelación', async () => {
    const worker = workerFalso(() => NO_CONTESTA);
    const control = new AbortController();
    const render = renderizarEnWorker(PEDIDO, { senal: control.signal, crear: crearCon(worker) });
    control.abort();
    await expect(render).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  test('si el pedido no cruza al worker, rechaza y un abort posterior no deja rechazos sueltos', async () => {
    const worker = workerFalso(() => NO_SE_PUEDE_CLONAR);
    const control = new AbortController();
    const sueltos = await rechazosSueltos(async () => {
      await expect(
        renderizarEnWorker(PEDIDO, { senal: control.signal, crear: crearCon(worker) }),
      ).rejects.toThrow('could not be cloned');
      control.abort();
    });
    expect(sueltos).toEqual([]);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  test('un abort después de la respuesta no cambia nada: la señal ya no tiene oyente', async () => {
    const worker = workerFalso(() => ({ blob: BLOB }));
    const control = new AbortController();
    const quitar = vi.spyOn(control.signal, 'removeEventListener');
    const sueltos = await rechazosSueltos(async () => {
      await expect(
        renderizarEnWorker(PEDIDO, { senal: control.signal, crear: crearCon(worker) }),
      ).resolves.toBe(BLOB);
      control.abort();
    });
    expect(sueltos).toEqual([]);
    expect(quitar).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  test('ya cancelado, ni crea el worker', async () => {
    const crear = vi.fn();
    const control = new AbortController();
    control.abort();
    await expect(
      renderizarEnWorker(PEDIDO, { senal: control.signal, crear }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(crear).not.toHaveBeenCalled();
  });
});

describe('atenderPedido', () => {
  test('contesta el PDF', async () => {
    await expect(atenderPedido(PEDIDO, async () => BLOB)).resolves.toEqual({ blob: BLOB });
  });

  test('un error viaja como texto: un Error no cruza entero al hilo principal', async () => {
    const fallar = async () => {
      throw new Error('fuente rota');
    };
    await expect(atenderPedido(PEDIDO, fallar)).resolves.toEqual({ error: 'fuente rota' });
  });
});
