import { Document } from '@react-pdf/renderer';
import { NOTA_SATELITE } from '../mapa/LlamadaSatelite';
import { esMapaSatelital } from '../mapa/estadoMapa';
import { Hoja, type NotaAlPie } from '../plantilla/Hoja';
import { TEXTO_PLANTILLA, type EmisionPdf } from '../plantilla/textos';
import { documentoDeFichas, type ModeloFicha } from './datosFicha';
import { Ficha } from './Ficha';

export type DocumentoFichasProps = EmisionPdf & { fichas: readonly ModeloFicha[] };

const NOTA_DE_SATELITE: NotaAlPie = { texto: NOTA_SATELITE, enHoja: () => true };

/** La atribución de Esri, solo al pie de la hoja cuyo minimapa es satelital. */
function notaDeSatelite(ficha: ModeloFicha): NotaAlPie | undefined {
  return esMapaSatelital(ficha.mapa) ? NOTA_DE_SATELITE : undefined;
}

/** Una ficha por hoja. */
export function DocumentoFichas({ encabezado, emitido, fichas }: DocumentoFichasProps) {
  const documento = documentoDeFichas(fichas.length);
  return (
    <Document
      title={`${documento}${TEXTO_PLANTILLA.separador}${encabezado.titulo}`}
      creator={TEXTO_PLANTILLA.marca}
      producer={TEXTO_PLANTILLA.marca}
    >
      {fichas.map((ficha, indice) => (
        <Hoja
          key={`${indice}-${ficha.idArbol}`}
          encabezado={encabezado}
          documento={documento}
          emitido={emitido}
          notaAlPie={notaDeSatelite(ficha)}
        >
          <Ficha ficha={ficha} />
        </Hoja>
      ))}
    </Document>
  );
}
