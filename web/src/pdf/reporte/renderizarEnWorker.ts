/*
 * react-pdf arma el documento de un tirón: 7.000 filas congelaban la pestaña
 * ~6 s, sin repintar ni el progreso. En un worker la página sigue viva.
 */
import type { PedidoRender, RespuestaRender } from './renderReporte';

type WorkerDeRender = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror'>;

export type CrearWorker = () => WorkerDeRender;

function crearWorkerDelReporte(): WorkerDeRender {
  return new Worker(new URL('./reporte.worker.ts', import.meta.url), { type: 'module' });
}

function esperarRespuesta(worker: WorkerDeRender): Promise<Blob> {
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<RespuestaRender>) => {
      if ('blob' in data) resolve(data.blob);
      else reject(new Error(data.error));
    };
    worker.onerror = (evento) => reject(new Error(evento.message));
  });
}

/**
 * Un worker por documento: al terminarlo se libera la memoria del armado, que
 * con miles de filas pasa los 500 MB.
 */
export async function renderizarEnWorker(
  pedido: PedidoRender,
  crear: CrearWorker = crearWorkerDelReporte,
): Promise<Blob> {
  const worker = crear();
  try {
    const respuesta = esperarRespuesta(worker);
    worker.postMessage(pedido);
    return await respuesta;
  } finally {
    worker.terminate();
  }
}
