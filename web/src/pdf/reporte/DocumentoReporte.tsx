import { Document } from '@react-pdf/renderer';
import { Hoja } from '../plantilla/Hoja';
import { TEXTO_PLANTILLA, type EmisionPdf } from '../plantilla/textos';
import { ORIENTACION_HOJA } from '../plantilla/tokens';
import { Escalon, NIVELES_DE_ESCALON } from './Escalon';
import { documentoDeReporte, type ModeloArbolReporte, type ModeloTarjeta } from './datosReporte';
import { Listado } from './Listado';
import { esHojaDeTarjetas, paginarReporte, type HojaReporte, type Reparto } from './planReporte';
import { GrillaTarjetas } from './Tarjeta';

export type DocumentoReporteProps = EmisionPdf & {
  reparto: Reparto<ModeloTarjeta, ModeloArbolReporte>;
};

function Contenido({ hoja }: { hoja: HojaReporte<ModeloTarjeta, ModeloArbolReporte> }) {
  if (esHojaDeTarjetas(hoja)) return <GrillaTarjetas tarjetas={hoja.tarjetas} />;
  return <Listado filas={hoja.filas} />;
}

/** Una hoja horizontal por cada una del plan: primero las tarjetas, después el listado. */
export function DocumentoReporte({ encabezado, emitido, reparto }: DocumentoReporteProps) {
  const documento = documentoDeReporte(reparto.tarjetas.length + reparto.listado.length);
  const hojas = paginarReporte(reparto);
  return (
    <Document
      title={`${documento}${TEXTO_PLANTILLA.separador}${encabezado.titulo}`}
      creator={TEXTO_PLANTILLA.marca}
      producer={TEXTO_PLANTILLA.marca}
    >
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
    </Document>
  );
}
