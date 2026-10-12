import { Image, Page, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { hojaStyles as styles } from './Hoja.styles';
import { TEXTO_PLANTILLA, textoPiePagina, type EncabezadoPdf } from './textos';
import { ORIENTACION_HOJA, type OrientacionHoja } from './tokens';

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

/** Vacía en las hojas que no la llevan. */
function NotaPie({ nota }: { nota: NotaAlPie }) {
  return (
    <Text
      style={styles.notaAlPie}
      render={({ pageNumber, totalPages }) =>
        nota.enHoja(pageNumber, totalPages) ? nota.texto : ''
      }
    />
  );
}

/** Número de una hoja que se paginó antes de renderizar, y el total del documento. */
export type PaginaFija = { numero: number; total: number };

/**
 * Escrito, si la hoja ya sabe su número: con `render`, react-pdf vuelve a
 * maquetar cada hoja para resolverlo, y con cientos de hojas se nota.
 */
function NumeroDePagina({ emitido, pagina }: { emitido: string; pagina?: PaginaFija }) {
  if (pagina) return <Text>{textoPiePagina(emitido, pagina.numero, pagina.total)}</Text>;
  return (
    <Text
      render={({ pageNumber, totalPages }) => textoPiePagina(emitido, pageNumber, totalPages)}
    />
  );
}

type PieProps = { documento: string; emitido: string; nota?: NotaAlPie; pagina?: PaginaFija };

function Pie({ documento, emitido, nota, pagina }: PieProps) {
  return (
    <View style={styles.pie} fixed>
      <Text>
        <Text style={styles.pieMarca}>{TEXTO_PLANTILLA.marca}</Text>
        {TEXTO_PLANTILLA.separador}
        {documento}
      </Text>
      {nota && <NotaPie nota={nota} />}
      <NumeroDePagina emitido={emitido} pagina={pagina} />
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
  /** Parada si no se indica. */
  orientacion?: OrientacionHoja;
  /** Para un documento que ya se paginó: el número de hoja va escrito. */
  paginaFija?: PaginaFija;
  children: ReactNode;
};

/** Página A4 de marca: encabezado y pie se repiten en cada hoja si el cuerpo no entra en una. */
export function Hoja({
  encabezado,
  documento,
  emitido,
  notaAlPie,
  orientacion = ORIENTACION_HOJA.vertical,
  paginaFija,
  children,
}: HojaProps) {
  return (
    <Page size={TAMANO_HOJA} orientation={orientacion} style={styles.pagina}>
      <Encabezado encabezado={encabezado} />
      {children}
      <Pie documento={documento} emitido={emitido} nota={notaAlPie} pagina={paginaFija} />
    </Page>
  );
}
