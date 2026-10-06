import { Image, Page, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { hojaStyles as styles } from './Hoja.styles';
import { TEXTO_PLANTILLA, textoPiePagina, type EncabezadoPdf } from './textos';

const TAMANO_HOJA = 'A4';

function Encabezado({ encabezado }: { encabezado: EncabezadoPdf }) {
  return (
    <View style={styles.encabezado} fixed>
      <Image style={styles.logo} src={encabezado.logo} />
      <View style={styles.plantacion}>
        <Text style={styles.titulo}>{encabezado.titulo}</Text>
        <Text style={styles.detalle}>{encabezado.detalle}</Text>
      </View>
    </View>
  );
}

/** Una nota que va al pie solo de algunas hojas, como la atribución del satélite. */
export type NotaAlPie = { texto: string; enHoja: (hoja: number, total: number) => boolean };

type PieProps = { documento: string; emitido: string; nota?: NotaAlPie };

function Pie({ documento, emitido, nota }: PieProps) {
  return (
    <View style={styles.pie} fixed>
      <Text>
        <Text style={styles.pieMarca}>{TEXTO_PLANTILLA.marca}</Text>
        {TEXTO_PLANTILLA.separador}
        {documento}
      </Text>
      {nota && (
        <Text
          style={styles.notaAlPie}
          render={({ pageNumber, totalPages }) =>
            nota.enHoja(pageNumber, totalPages) ? nota.texto : ''
          }
        />
      )}
      <Text
        render={({ pageNumber, totalPages }) => textoPiePagina(emitido, pageNumber, totalPages)}
      />
    </View>
  );
}

export type HojaProps = {
  encabezado: EncabezadoPdf;
  /** Nombre del documento en el pie, ej. «Ficha de árbol». */
  documento: string;
  /** Fecha de emisión ya formateada. */
  emitido: string;
  notaAlPie?: NotaAlPie;
  children: ReactNode;
};

/** Página A4 de marca: encabezado y pie se repiten en cada hoja si el cuerpo no entra en una. */
export function Hoja({ encabezado, documento, emitido, notaAlPie, children }: HojaProps) {
  return (
    <Page size={TAMANO_HOJA} style={styles.pagina}>
      <Encabezado encabezado={encabezado} />
      {children}
      <Pie documento={documento} emitido={emitido} nota={notaAlPie} />
    </Page>
  );
}
