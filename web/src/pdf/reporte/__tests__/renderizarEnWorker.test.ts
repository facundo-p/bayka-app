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

/** Un worker que contesta lo que se le diga, o falla al cargar. */
function workerFalso(
  contestar: (pedido: PedidoRender) => RespuestaRender | typeof FALLA_AL_CARGAR,
) {
  const worker = {
    onmessage: null as ((evento: MessageEvent) => void) | null,
    onerror: null as ((evento: ErrorEvent) => void) | null,
    postMessage: vi.fn((pedido: PedidoRender) => {
      const respuesta = contestar(pedido);
      queueMicrotask(() => {
        if (respuesta === FALLA_AL_CARGAR) {
          worker.onerror?.(new ErrorEvent('error', { message: 'window is not defined' }));
        } else worker.onmessage?.(new MessageEvent('message', { data: respuesta }));
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

describe('renderizarEnWorker', () => {
  test('le manda el pedido al worker, devuelve su PDF y lo termina', async () => {
    const worker = workerFalso(() => ({ blob: BLOB }));
    await expect(renderizarEnWorker(PEDIDO, crearCon(worker))).resolves.toBe(BLOB);
    expect(worker.postMessage).toHaveBeenCalledWith(PEDIDO);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  test('si el render falla, rechaza con su mensaje y también lo termina', async () => {
    const worker = workerFalso(() => ({ error: 'fuente rota' }));
    await expect(renderizarEnWorker(PEDIDO, crearCon(worker))).rejects.toThrow('fuente rota');
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  test('si el worker no llega a cargar, rechaza en vez de quedar esperando', async () => {
    const worker = workerFalso(() => FALLA_AL_CARGAR);
    await expect(renderizarEnWorker(PEDIDO, crearCon(worker))).rejects.toThrow(
      'window is not defined',
    );
    expect(worker.terminate).toHaveBeenCalledOnce();
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
