/*
 * Renders del reporte en node fuera del camino del worker: sin partir los
 * textos, o un cuerpo suelto en una hoja.
 */
import { Document, renderToBuffer } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { renderizarEnSerie } from '../pdf/plantilla/fuentes';
import { Hoja } from '../pdf/plantilla/Hoja';
import { ORIENTACION_HOJA } from '../pdf/plantilla/tokens';
import { DocumentoReporte } from '../pdf/reporte/DocumentoReporte';
import { FUENTES_NODE, paginasDelPdf } from './pdfNode';
import { EMITIDO, ENCABEZADO, enUnRenglon, type repartoDe } from './reportePdf';

/** El documento sin partir ni cortar nada antes del render. */
export function renderizarSinPartir(reparto: ReturnType<typeof repartoDe>) {
  return renderizarEnSerie(FUENTES_NODE, () =>
    renderToBuffer(
      <DocumentoReporte encabezado={ENCABEZADO} emitido={EMITIDO} reparto={enUnRenglon(reparto)} />,
    ),
  );
}

/** Las hojas que ocupa un cuerpo puesto en una sola hoja del reporte: si no entra, salen más. */
export async function hojasQueOcupa(cuerpo: ReactNode) {
  const pdf = await renderizarEnSerie(FUENTES_NODE, () =>
    renderToBuffer(
      <Document>
        <Hoja
          orientacion={ORIENTACION_HOJA.horizontal}
          encabezado={ENCABEZADO}
          documento="Reporte"
          emitido={EMITIDO}
        >
          {cuerpo}
        </Hoja>
      </Document>,
    ),
  );
  return paginasDelPdf(pdf);
}
