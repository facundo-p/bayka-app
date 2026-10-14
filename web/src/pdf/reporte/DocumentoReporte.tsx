import { DocumentoPdf } from '../plantilla/DocumentoPdf';
import { Hoja } from '../plantilla/Hoja';
import type { EmisionPdf } from '../plantilla/textos';
import { ORIENTACION_HOJA } from '../plantilla/tokens';
import { ALTOS_EN_RENGLONES } from './altosReporte';
import { Escalon, NIVELES_DE_ESCALON } from './Escalon';
import { documentoDeReporte, type ModeloArbolReporte, type ModeloTarjeta } from './datosReporte';
import { Listado } from './Listado';
import { esHojaDeTarjetas, paginarReporte, type HojaReporte, type Reparto } from './planReporte';
import type { FilaEnRenglones, RepartoEnRenglones, TarjetaEnRenglones } from './renglonesReporte';
import { GrillaTarjetas } from './Tarjeta';

/** Lo que viaja al worker: los textos todavía enteros, sin medir. */
export type DatosDocumentoReporte = EmisionPdf & {
  reparto: Reparto<ModeloTarjeta, ModeloArbolReporte>;
};

type DocumentoReporteProps = EmisionPdf & { reparto: RepartoEnRenglones };

function Contenido({ hoja }: { hoja: HojaReporte<TarjetaEnRenglones, FilaEnRenglones> }) {
  if (esHojaDeTarjetas(hoja)) return <GrillaTarjetas tarjetas={hoja.tarjetas} />;
  return <Listado filas={hoja.filas} />;
}

/** Una hoja horizontal por cada una del plan: primero las tarjetas, después el listado. */
export function DocumentoReporte({ encabezado, emitido, reparto }: DocumentoReporteProps) {
  const documento = documentoDeReporte(reparto.tarjetas.length + reparto.listado.length);
  const hojas = paginarReporte(reparto, ALTOS_EN_RENGLONES);
  return (
    <DocumentoPdf documento={documento} encabezado={encabezado}>
      {hojas.map((hoja, indice) => (
        <Hoja
          key={indice}
          orientacion={ORIENTACION_HOJA.horizontal}
          paginaFija={{ numero: indice + 1, total: hojas.length }}
          encabezado={encabezado}
          documento={documento}
          emitido={emitido}
        >
          <Escalon nivel={indice % NIVELES_DE_ESCALON}>
            <Contenido hoja={hoja} />
          </Escalon>
        </Hoja>
      ))}
    </DocumentoPdf>
  );
}
