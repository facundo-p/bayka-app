import { NOTA_SATELITE } from '../mapa/LlamadaSatelite';
import { esMapaSatelital } from '../mapa/estadoMapa';
import { DocumentoPdf } from '../plantilla/DocumentoPdf';
import { Hoja, type NotaAlPie } from '../plantilla/Hoja';
import type { EmisionPdf } from '../plantilla/textos';
import type { ModeloFicha } from './datosFicha';
import { Ficha } from './Ficha';
import { TEXTO_FICHA } from './textosFicha';

export type DocumentoFichaProps = EmisionPdf & { ficha: ModeloFicha };

const NOTA_DE_SATELITE: NotaAlPie = { texto: NOTA_SATELITE, enHoja: () => true };

/** La atribución de Esri, solo si el minimapa es satelital. */
function notaDeSatelite(ficha: ModeloFicha): NotaAlPie | undefined {
  return esMapaSatelital(ficha.mapa) ? NOTA_DE_SATELITE : undefined;
}

/** La ficha de un árbol, en una hoja. */
export function DocumentoFicha({ encabezado, emitido, ficha }: DocumentoFichaProps) {
  return (
    <DocumentoPdf documento={TEXTO_FICHA.documento} encabezado={encabezado}>
      <Hoja
        encabezado={encabezado}
        documento={TEXTO_FICHA.documento}
        emitido={emitido}
        notaAlPie={notaDeSatelite(ficha)}
      >
        <Ficha ficha={ficha} />
      </Hoja>
    </DocumentoPdf>
  );
}
