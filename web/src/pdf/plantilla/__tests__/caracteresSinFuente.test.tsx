// @vitest-environment node
// Los tres documentos por sus motores, con las fuentes de node (#882).
import { Document, Page, renderToBuffer, Text } from '@react-pdf/renderer';
import type { ArbolParaFicha } from '../../../queries/fichasQueries';
import { arbolParaFicha, coloresEnOrden } from '../../../test/fabricas';
import { entradaInforme } from '../../../test/informePdf';
import { FUENTES_NODE, LOGO_NODE, PNG_DE_PRUEBA } from '../../../test/pdfNode';
import { textosDelPdf } from '../../../test/textoPdf';
import { ESTADO_FOTO } from '../../estadoFoto';
import { ESTADO_MAPA } from '../../mapa/estadoMapa';
import { datosFicha } from '../../ficha/datosFicha';
import { renderizarFicha } from '../../ficha/motorFicha';
import { datosInforme } from '../../informe/datosInforme';
import { dibujarMapaInforme } from '../../informe/mapaInforme';
import { renderizarInforme, type PedidoInforme } from '../../informe/motorInforme';
import { informeEnRenglones, leerMedidoresInforme } from '../../informe/renglonesInforme';
import { datosArbolReporte, datosTarjeta } from '../../reporte/datosReporte';
import { renderizarDocumento } from '../../reporte/renderReporte';
import { leerMedidoresReporte, repartoEnRenglones } from '../../reporte/renglonesReporte';
import { renderizarEnSerie, renderizarSaneado } from '../fuentes';
import type { TextoEnRenglones } from '../partirTexto';
import { encabezadoDePlantacion } from '../textos';
import { FUENTE_PDF, PESO_FUENTE } from '../tokens';

vi.mock('../textoLargo', () => ({ CORTAR_TEXTO_LARGO: false }));
vi.mock('../recursosNavegador', async () => {
  const recursos = await import('../../../test/pdfNode');
  return {
    archivosFuentesNavegador: () => recursos.FUENTES_NODE,
    logoNavegador: () => recursos.LOGO_NODE,
  };
});
vi.mock('../../informe/mapaInforme', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../informe/mapaInforme')>()),
  dibujarMapaInforme: vi.fn(),
}));

/** «ĩ» y «ũ»: ni Poppins ni Helvetica, pero sí sus letras base. «Σ», CJK y el emoji: ninguna fuente del cuerpo. */
const PARCELA_GUARANI = 'Ñu Guasũ ĩ';
const ESPECIE_SIN_FUENTE = 'Yerba Σ 中文 😀';
const GRUPO_CON_SALTO = 'Línea\n10';

/**
 * Sin fuente, «中» mide 0: el texto crudo entra en un renglón. Saneado, cada «?»
 * ocupa su ancho y no entra ni en la leyenda del mapa ni en la columna del listado.
 */
const CODIGO_SIN_FUENTE = `YER${'中'.repeat(8)}`;
const NOMBRE_SIN_FUENTE = `Ladera ${'中'.repeat(32)}`;

const ENCABEZADO = encabezadoDePlantacion(
  { lugar: 'San Sebastián', periodo: '2025-2026' },
  LOGO_NODE,
);
const EMISION = { encabezado: ENCABEZADO, emitido: '12/10/2026' };
const COLOR_DE = coloresEnOrden('YER');
const FOTO = { estado: ESTADO_FOTO.lista, src: PNG_DE_PRUEBA } as const;
const MAPA = { estado: ESTADO_MAPA.listo, src: PNG_DE_PRUEBA, conSatelite: false } as const;

beforeEach(() => {
  vi.mocked(dibujarMapaInforme).mockResolvedValue({ mapa: MAPA });
});

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

/** Con mapa: el código de la primera especie va también en su leyenda. */
function pedidoInforme(): PedidoInforme {
  const entrada = entradaInforme({ parcelas: 2, especies: 2 });
  const [primera, ...resto] = entrada.dashboard.porEspecie;
  const conCodigo = <T extends { codigo: string }>(item: T) =>
    item.codigo === primera.codigo ? { ...item, codigo: CODIGO_SIN_FUENTE } : item;
  const porEspecie = [{ ...conCodigo(primera), nombre: ESPECIE_SIN_FUENTE }, ...resto];
  return {
    ...entrada,
    ...EMISION,
    plantacion: { ...entrada.plantacion, lugar: PARCELA_GUARANI },
    organizacion: GRUPO_CON_SALTO,
    dashboard: { ...entrada.dashboard, porEspecie },
    puntos: entrada.puntos?.map(conCodigo) ?? null,
  };
}

const informe = () => renderizarInforme(pedidoInforme());

const repartoDe = (arbol: ArbolParaFicha) => ({
  tarjetas: [datosTarjeta(arbol, FOTO, COLOR_DE)],
  listado: [datosArbolReporte({ ...arbol, fotoUrl: null }, COLOR_DE)],
});

const reporte = (reparto = repartoDe(ARBOL)) =>
  renderizarDocumento({ documento: { ...EMISION, reparto }, fuentes: FUENTES_NODE });

/** El segundo PDF de la sesión: el primero ya leyó las fuentes, y este las descarta. */
async function textosDelSegundo(armar: () => Promise<Blob>): Promise<string> {
  await armar();
  return (await textosDe(await armar())).join('\n');
}

test.each([
  ['la ficha', ficha],
  ['el informe', informe],
  ['el reporte', reporte],
])('%s sale dos veces seguidas, sin perder lo que no tiene glifo', async (_, armar) => {
  const textos = await textosDelSegundo(armar);
  expect(textos).toContain('Ñu Guasu i');
  expect(textos).toContain('Yerba ? ?? ?');
  expect(textos).toContain('Línea 10');
});

/** Los renglones de un texto partido después de sanear, como en los motores, y antes. */
async function partidoAntesYDespues<P, R>(
  props: P,
  partir: (props: P) => Promise<R>,
  renglones: (partido: R) => TextoEnRenglones,
) {
  const saneado = renglones(await renderizarSaneado(FUENTES_NODE, props, partir));
  const crudo = renglones(await renderizarEnSerie(FUENTES_NODE, () => partir(props)));
  return { saneado, crudo };
}

/**
 * Los motores sanean antes de partir: se dibujan los renglones de lo saneado.
 * Partido antes, el texto crudo iría en un renglón y textkit apretaría los «?»
 * que no le entran.
 */
async function dibujaLoPartidoSaneado(
  blob: Blob,
  { saneado, crudo }: { saneado: TextoEnRenglones; crudo: TextoEnRenglones },
) {
  expect(crudo).toHaveLength(1);
  expect(saneado.length).toBeGreaterThan(1);
  expect(await textosDe(blob)).toEqual(expect.arrayContaining([...saneado]));
}

test('el reporte sanea antes de partir: parte lo que dibuja', async () => {
  const reparto = repartoDe({ ...ARBOL, parcela: { codigo: 'P1', nombre: NOMBRE_SIN_FUENTE } });
  const partido = await partidoAntesYDespues(
    reparto,
    async (props) => repartoEnRenglones(props, await leerMedidoresReporte()),
    ({ listado }) => listado[0].parcela!.nombre,
  );
  await dibujaLoPartidoSaneado(await reporte(reparto), partido);
});

test('el informe sanea antes de partir: parte lo que dibuja en la leyenda del mapa', async () => {
  const pedido = pedidoInforme();
  const partido = await partidoAntesYDespues(
    datosInforme(pedido),
    async (props) => informeEnRenglones(props, await leerMedidoresInforme()),
    ({ mapa }) => mapa!.leyenda[0].texto,
  );
  await dibujaLoPartidoSaneado(await renderizarInforme(pedido), partido);
});

const NEGRITA = { fontFamily: FUENTE_PDF.cuerpo, fontWeight: PESO_FUENTE.bold };

const unRenglon = (texto: string) => (
  <Document>
    <Page>
      <Text style={NEGRITA}>{texto}</Text>
    </Page>
  </Document>
);

/** Un renglón en Poppins negrita, sin sanear: acá se prueba el descarte de las fuentes. */
function renglon(texto: string): Promise<Buffer> {
  return renderizarEnSerie(FUENTES_NODE, () => renderToBuffer(unRenglon(texto)));
}

test('un texto que es solo un guion blando no tira el PDF', async () => {
  // textkit saltea el guion blando: sin un carácter antes, el texto se queda sin fuente.
  const pdf = renderizarSaneado(FUENTES_NODE, { texto: '\u00ad' }, (saneado) =>
    renderToBuffer(unRenglon(saneado.texto)),
  );
  await expect(pdf).resolves.toBeInstanceOf(Buffer);
});

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
