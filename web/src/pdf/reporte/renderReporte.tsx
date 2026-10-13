/*
 * El render del reporte, sin nada de `window`: corre dentro del worker. Todo lo
 * que necesita viaja en el pedido, que es serializable.
 */
import { pdf } from '@react-pdf/renderer';
import { renderizarEnSerie, type ArchivosFuentes } from '../plantilla/fuentes';
import { cortarReparto, leerMedidoresReporte } from './cortesReporte';
import { DocumentoReporte, type DocumentoReporteProps } from './DocumentoReporte';

export type PedidoRender = { documento: DocumentoReporteProps; fuentes: ArchivosFuentes };

export type RespuestaRender = { blob: Blob } | { error: string };

export function renderizarDocumento({ documento, fuentes }: PedidoRender): Promise<Blob> {
  return renderizarEnSerie(fuentes, async () => {
    const reparto = cortarReparto(documento.reparto, await leerMedidoresReporte());
    return pdf(<DocumentoReporte {...documento} reparto={reparto} />).toBlob();
  });
}

/** Lo que el worker contesta: el PDF, o el mensaje del error (un Error no se clona entero). */
export async function atenderPedido(
  pedido: PedidoRender,
  renderizar: (pedido: PedidoRender) => Promise<Blob> = renderizarDocumento,
): Promise<RespuestaRender> {
  try {
    return { blob: await renderizar(pedido) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
