// @vitest-environment node
/*
 * ANCHO_TEXTO_REPORTE contra las cajas que arma react-pdf, sin el corte: un
 * renglón apenas más angosto que su ancho sale entero, y uno apenas más ancho
 * ya no, porque textkit lo parte o le achica los espacios.
 */
import { renderToBuffer } from '@react-pdf/renderer';
import { arbolParaFicha, coloresEnOrden } from '../../../test/fabricas';
import { FUENTES_NODE, LOGO_NODE, PNG_DE_PRUEBA } from '../../../test/pdfNode';
import { textosConGlifosCorridos, textosDelPdf } from '../../../test/textoPdf';
import { TEXTO_ARBOL } from '../../arbol/textosArbol';
import { ESTADO_FOTO, type FotoPdf } from '../../estadoFoto';
import type { Medidor } from '../../plantilla/cortarTexto';
import { registrarFuentes, renderizarEnSerie } from '../../plantilla/fuentes';
import { encabezadoDePlantacion } from '../../plantilla/textos';
import { ANCHO_TEXTO_REPORTE } from '../../plantilla/tokens';
import { leerMedidoresReporte, type MedidoresReporte } from '../cortesReporte';
import { datosArbolReporte, datosTarjeta, type ModeloArbolReporte } from '../datosReporte';
import { DocumentoReporte } from '../DocumentoReporte';

/** Lo más lejos del borde que puede quedar el texto de prueba, en pt. */
const MARGEN = 0.5;

/** Más cerca del borde, el float32 de yoga decide para cualquier lado. */
const AL_RAS = 0.01;

const LADO = { adentro: 'adentro', afuera: 'afuera' } as const;
type Lado = (typeof LADO)[keyof typeof LADO];

const CODIGO = 'P1';

/** Una caja por renglón que se corta; la de grupo es igual a la de parcela. */
const CAJAS = {
  especieFila: { letra: 'fila', ancho: ANCHO_TEXTO_REPORTE.listado.especie, conCodigo: false },
  nombreFila: { letra: 'fila', ancho: ANCHO_TEXTO_REPORTE.listado.parcela, conCodigo: true },
  especieTarjeta: {
    letra: 'especieTarjeta',
    ancho: ANCHO_TEXTO_REPORTE.tarjeta.especie,
    conCodigo: false,
  },
  nombreTarjeta: { letra: 'dato', ancho: ANCHO_TEXTO_REPORTE.tarjeta.parcela, conCodigo: true },
} as const;

type Caja = keyof typeof CAJAS;

/** Con espacios: textkit tiene dónde partir el renglón y qué achicar. */
const RELLENO = 'nnnnn ';
const LETRAS = [...'abcdefghijklmnopqrstuvwxyz'];
const FINALES = LETRAS.flatMap((primera) => LETRAS.map((segunda) => primera + segunda));

/** Relleno hasta donde un final de dos letras todavía puede llegar a `objetivo`. */
function relleno(medir: Medidor, objetivo: number): string {
  const finalMasCorto = Math.min(...FINALES.map(medir));
  const siguiente = (texto: string) => texto + RELLENO[texto.length % RELLENO.length];
  let texto = '';
  while (objetivo - medir(siguiente(texto)) >= finalMasCorto) texto = siguiente(texto);
  return texto;
}

/** El texto que queda más cerca de `objetivo` sin cruzarlo: adentro, más angosto; afuera, más ancho. */
function alBorde(medir: Medidor, objetivo: number, lado: Lado) {
  const base = relleno(medir, objetivo);
  const signo = lado === LADO.adentro ? 1 : -1;
  return FINALES.map((final) => {
    const texto = base + final;
    return { texto, distancia: signo * (objetivo - medir(texto)) };
  })
    .filter(({ distancia }) => distancia >= AL_RAS)
    .reduce((mejor, otro) => (otro.distancia < mejor.distancia ? otro : mejor));
}

/** El ancho de lo que va en el renglón detrás del código, si lo lleva. */
function objetivoDe(caja: Caja, medidores: MedidoresReporte): number {
  const { letra, ancho, conCodigo } = CAJAS[caja];
  if (!conCodigo) return ancho;
  return ancho - medidores.codigo(CODIGO) - medidores[letra](TEXTO_ARBOL.separadorCodigo);
}

function textosAlBorde(medidores: MedidoresReporte, lado: Lado) {
  const cajas = Object.keys(CAJAS) as Caja[];
  return Object.fromEntries(
    cajas.map((caja) => {
      const medir = medidores[CAJAS[caja].letra];
      return [caja, alBorde(medir, objetivoDe(caja, medidores), lado)];
    }),
  ) as Record<Caja, ReturnType<typeof alBorde>>;
}

const COLOR_DE = coloresEnOrden('ANC');
const LISTA: FotoPdf = { estado: ESTADO_FOTO.lista, src: PNG_DE_PRUEBA };
const ENCABEZADO = encabezadoDePlantacion(
  { lugar: 'San Sebastián', periodo: '2025-2026', codigo: 'SS26' },
  'Bayka',
  LOGO_NODE,
);

const conTextos = <T extends ModeloArbolReporte>(modelo: T, especie: string, nombre: string) => ({
  ...modelo,
  especie: { ...modelo.especie, titulo: especie },
  parcela: { codigo: CODIGO, nombre },
});

/** Una tarjeta y una fila, sin pasar por el corte. */
function renderizar(textos: Record<Caja, { texto: string }>) {
  const arbol = arbolParaFicha({ fotoUrl: 'p/arbol.jpg' });
  const { especieFila, nombreFila, especieTarjeta, nombreTarjeta } = textos;
  const reparto = {
    tarjetas: [
      conTextos(datosTarjeta(arbol, LISTA, COLOR_DE), especieTarjeta.texto, nombreTarjeta.texto),
    ],
    listado: [conTextos(datosArbolReporte(arbol, COLOR_DE), especieFila.texto, nombreFila.texto)],
  };
  return renderizarEnSerie(FUENTES_NODE, () =>
    renderToBuffer(
      <DocumentoReporte encabezado={ENCABEZADO} emitido="12/10/2026" reparto={reparto} />,
    ),
  );
}

/** En un renglón, entero y con cada glifo en su lugar. */
const saleEntero = (pdf: Buffer, texto: string) =>
  textosDelPdf(pdf).some((renglon) => renglon.endsWith(texto)) &&
  !textosConGlifosCorridos(pdf).some((renglon) => renglon.endsWith(texto));

let medidores: MedidoresReporte;

beforeAll(async () => {
  registrarFuentes(FUENTES_NODE);
  medidores = await leerMedidoresReporte();
});

test.each([
  { lado: LADO.adentro, cuenta: 'sale entero', entero: true },
  { lado: LADO.afuera, cuenta: 'ya no sale entero', entero: false },
])('a menos de 0,5 pt del borde, $lado de cada caja, $cuenta', async ({ lado, entero }) => {
  const textos = textosAlBorde(medidores, lado);
  const pdf = await renderizar(textos);
  for (const [caja, { texto, distancia }] of Object.entries(textos)) {
    expect(distancia, caja).toBeLessThanOrEqual(MARGEN);
    expect(saleEntero(pdf, texto), caja).toBe(entero);
  }
});
