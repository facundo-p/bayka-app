/* Arma el PDF del reporte fuera del hilo principal (#849). */
import { atenderPedido, type PedidoRender } from './renderReporte';

addEventListener('message', async (evento: MessageEvent<PedidoRender>) => {
  postMessage(await atenderPedido(evento.data));
});
