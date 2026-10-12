/*
 * react-pdf arma el documento de un tirón: 7.000 filas congelaban la pestaña
 * ~6 s, sin repintar ni el progreso. En un worker la página sigue viva.
 */
import type { PedidoRender, RespuestaRender } from './renderReporte';

type WorkerDeRender = Pick<
  Worker,
  'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'
>;

export type CrearWorker = () => WorkerDeRender;

export const ERROR_RESPUESTA_ILEGIBLE = 'No se pudo leer el PDF que armó el worker';

function crearWorkerDelReporte(): WorkerDeRender {
  return new Worker(new URL('./reporte.worker.ts', import.meta.url), { type: 'module' });
}

/** Cualquier salida del worker resuelve o rechaza: sin respuesta, el modal quedaría esperando. */
function esperarRespuesta(worker: WorkerDeRender, senal: AbortSignal | undefined) {
  return new Promise<Blob>((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<RespuestaRender>) => {
      if ('blob' in data) resolve(data.blob);
      else reject(new Error(data.error));
    };
    worker.onerror = (evento) => reject(new Error(evento.message));
    worker.onmessageerror = () => reject(new Error(ERROR_RESPUESTA_ILEGIBLE));
    senal?.addEventListener('abort', () => reject(senal.reason), { once: true });
  });
}

type OpcionesRender = {
  /** Abortada, termina el worker en el acto y rechaza con su motivo. */
  senal?: AbortSignal;
  crear?: CrearWorker;
};

/**
 * Un worker por documento: al terminarlo se libera la memoria del armado, que
 * con miles de filas pasa los 500 MB.
 */
export async function renderizarEnWorker(
  pedido: PedidoRender,
  { senal, crear = crearWorkerDelReporte }: OpcionesRender = {},
): Promise<Blob> {
  senal?.throwIfAborted();
  const worker = crear();
  try {
    const respuesta = esperarRespuesta(worker, senal);
    worker.postMessage(pedido);
    return await respuesta;
  } finally {
    worker.terminate();
  }
}
