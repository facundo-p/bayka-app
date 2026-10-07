import { Document } from '@react-pdf/renderer';
import { NOTA_SATELITE } from '../mapa/LlamadaSatelite';
import { Hoja, type NotaAlPie } from '../plantilla/Hoja';
import { TEXTO_PLANTILLA, type EncabezadoPdf } from '../plantilla/textos';
import { documentoDeFichas, hojasConSatelite, type ModeloFicha } from './datosFicha';
import { Ficha } from './Ficha';

export type DocumentoFichasProps = {
  encabezado: EncabezadoPdf;
  emitido: string;
  fichas: readonly ModeloFicha[];
};

function notaDeSatelite(fichas: readonly ModeloFicha[]): NotaAlPie | undefined {
  const hojas = hojasConSatelite(fichas);
  if (hojas.size === 0) return undefined;
  return { texto: NOTA_SATELITE, enHoja: (hoja) => hojas.has(hoja) };
}

/** Una ficha o varias, tres por hoja, una debajo de la otra. */
export function DocumentoFichas({ encabezado, emitido, fichas }: DocumentoFichasProps) {
  const documento = documentoDeFichas(fichas.length);
  return (
    <Document
      title={`${documento}${TEXTO_PLANTILLA.separador}${encabezado.titulo}`}
      creator={TEXTO_PLANTILLA.marca}
      producer={TEXTO_PLANTILLA.marca}
    >
      <Hoja
        encabezado={encabezado}
        documento={documento}
        emitido={emitido}
        notaAlPie={notaDeSatelite(fichas)}
      >
        {fichas.map((ficha, indice) => (
          <Ficha key={`${indice}-${ficha.idArbol}`} ficha={ficha} />
        ))}
      </Hoja>
    </Document>
  );
}
