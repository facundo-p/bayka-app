// @vitest-environment node
// Los tres documentos por sus motores, con las fuentes de node (#882).
import { Document, Page, renderToBuffer, Text } from '@react-pdf/renderer';
import { arbolParaFicha, coloresEnOrden } from '../../../test/fabricas';
import { entradaInforme } from '../../../test/informePdf';
import { FUENTES_NODE, LOGO_NODE, PNG_DE_PRUEBA } from '../../../test/pdfNode';
import { textosDelPdf } from '../../../test/textoPdf';
import { ESTADO_FOTO } from '../../estadoFoto';
import { ESTADO_MAPA } from '../../mapa/estadoMapa';
import { datosFicha } from '../../ficha/datosFicha';
import { renderizarFicha } from '../../ficha/motorFicha';
import { renderizarInforme } from '../../informe/motorInforme';
import { datosArbolReporte, datosTarjeta } from '../../reporte/datosReporte';
import { renderizarDocumento } from '../../reporte/renderReporte';
import { renderizarEnSerie } from '../fuentes';
import { encabezadoDePlantacion } from '../textos';
import { FUENTE_PDF, PESO_FUENTE } from '../tokens';

vi.mock('../recursosNavegador', async () => {
  const recursos = await import('../../../test/pdfNode');
  return {
    archivosFuentesNavegador: () => recursos.FUENTES_NODE,
    logoNavegador: () => recursos.LOGO_NODE,
  };
});

/** «ĩ» y «ũ»: ni Poppins ni Helvetica. «Σ», CJK y el emoji: ninguna fuente del cuerpo. */
const PARCELA_GUARANI = 'Ñu Guasũ ĩ';
const ESPECIE_SIN_FUENTE = 'Yerba Σ 中文 😀';
const GRUPO_CON_SALTO = 'Línea\n10';

const ENCABEZADO = encabezadoDePlantacion(
  { lugar: 'San Sebastián', periodo: '2025-2026', codigo: 'SS26' },
  'Bayka',
  LOGO_NODE,
);
const EMISION = { encabezado: ENCABEZADO, emitido: '12/10/2026' };
const COLOR_DE = coloresEnOrden('YER');
const FOTO = { estado: ESTADO_FOTO.lista, src: PNG_DE_PRUEBA } as const;
const MAPA = { estado: ESTADO_MAPA.listo, src: PNG_DE_PRUEBA, conSatelite: false } as const;

const ARBOL = arbolParaFicha({
  especie: {
    codigo: 'YER',
    nombre: ESPECIE_SIN_FUENTE,
    nombreCientifico: 'Ilex paraguariensis',
    tipo: 'flora',
    subtipo: 'arbol',
  },
  parcela: { codigo: 'P1', nombre: PARCELA_GUARANI },
  grupo: { codigo: 'G1', nombre: GRUPO_CON_SALTO },
  fotoUrl: 'p/arbol.jpg',
  gps: { lat: -27.36, lng: -55.89, precision: 4 },
});

const textosDe = async (blob: Blob) => textosDelPdf(Buffer.from(await blob.arrayBuffer()));

function ficha() {
  const modelo = datosFicha(ARBOL, { colorDe: COLOR_DE, tecnico: 'Lucía', foto: FOTO, mapa: MAPA });
  return renderizarFicha({ ...EMISION, ficha: modelo });
}

function informe() {
  const entrada = entradaInforme({ parcelas: 2, especies: 2, conGps: false });
  const [primera, ...resto] = entrada.dashboard.porEspecie;
  const porEspecie = [{ ...primera, nombre: ESPECIE_SIN_FUENTE }, ...resto];
  return renderizarInforme({
    ...entrada,
    ...EMISION,
    plantacion: { ...entrada.plantacion, lugar: PARCELA_GUARANI },
    organizacion: GRUPO_CON_SALTO,
    dashboard: { ...entrada.dashboard, porEspecie },
  });
}

function reporte() {
  const reparto = {
    tarjetas: [datosTarjeta(ARBOL, FOTO, COLOR_DE)],
    listado: [datosArbolReporte({ ...ARBOL, fotoUrl: null }, COLOR_DE)],
  };
  return renderizarDocumento({ documento: { ...EMISION, reparto }, fuentes: FUENTES_NODE });
}

/** El segundo PDF de la sesión: el primero ya leyó las fuentes, y este las descarta. */
async function textosDelSegundo(armar: () => Promise<Blob>): Promise<string> {
  await armar();
  return (await textosDe(await armar())).join('\n');
}

test.each([
  ['la ficha', ficha],
  ['el informe', informe],
  ['el reporte', reporte],
])('%s sale dos veces seguidas, con «?» donde no hay glifo', async (_, armar) => {
  const textos = await textosDelSegundo(armar);
  expect(textos).toContain('Ñu Guas? ?');
  expect(textos).toContain('Yerba ? ?? ?');
  expect(textos).toContain('Línea 10');
});

const NEGRITA = { fontFamily: FUENTE_PDF.cuerpo, fontWeight: PESO_FUENTE.bold };

/** Un renglón en Poppins negrita, sin sanear: acá se prueba el descarte de las fuentes. */
function renglon(texto: string): Promise<Buffer> {
  return renderizarEnSerie(FUENTES_NODE, () =>
    renderToBuffer(
      <Document>
        <Page>
          <Text style={NEGRITA}>{texto}</Text>
        </Page>
      </Document>,
    ),
  );
}

test('lo que solo tiene Helvetica sale en dos PDF seguidos, con Helvetica', async () => {
  // Poppins no tiene «Š» ni «ž»: textkit las toma de Helvetica, su respaldo.
  await renglon('Šiauliai ž');
  const pdf = await renglon('Šiauliai ž');
  expect(pdf.toString('latin1')).toContain('/BaseFont /Helvetica-Bold');
});

test('el segundo PDF conserva los caracteres que el primero usó dentro de otros', async () => {
  // fontkit guarda «a» y «.» sin su carácter si el PDF anterior los usó en «á» y «·».
  await renglon('á·');
  expect(textosDelPdf(await renglon('a.'))).toContain('a.');
});
