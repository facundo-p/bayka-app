/*
 * El render del reporte, sin nada de `window`: corre dentro del worker. Todo lo
 * que necesita viaja en el pedido, que es serializable.
 */
import { pdf } from '@react-pdf/renderer';
import { renderizarSaneado, type ArchivosFuentes } from '../plantilla/fuentes';
import { DocumentoReporte, type DatosDocumentoReporte } from './DocumentoReporte';
import { leerMedidoresReporte, repartoEnRenglones } from './renglonesReporte';

export type PedidoRender = { documento: DatosDocumentoReporte; fuentes: ArchivosFuentes };

export type RespuestaRender = { blob: Blob } | { error: string };

export function renderizarDocumento({ documento, fuentes }: PedidoRender): Promise<Blob> {
  // Se sanea antes de partir en renglones: se mide lo que se va a dibujar.
  return renderizarSaneado(fuentes, documento, async (saneado) => {
    const reparto = repartoEnRenglones(saneado.reparto, await leerMedidoresReporte());
    return pdf(<DocumentoReporte {...saneado} reparto={reparto} />).toBlob();
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
