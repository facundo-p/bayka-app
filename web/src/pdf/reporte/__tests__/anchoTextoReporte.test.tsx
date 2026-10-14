// @vitest-environment node
/*
 * ANCHO_TEXTO_REPORTE contra las cajas que arma react-pdf, sin partir ni cortar:
 * un renglón apenas más angosto que su ancho sale entero, y uno apenas más
 * ancho ya no, porque textkit lo parte o le achica los espacios. En mono, como
 * el ID, el borde está a un carácter.
 */
import { arbolParaFicha } from '../../../test/fabricas';
import { FUENTES_NODE } from '../../../test/pdfNode';
import { renderizarSinPartir } from '../../../test/hojasReporte';
import { COLOR_DE, LISTA } from '../../../test/reportePdf';
import { textosConGlifosCorridos, textosDelPdf } from '../../../test/textoPdf';
import { TEXTO_ARBOL } from '../../arbol/textosArbol';
import type { Medidor } from '../../plantilla/medirTexto';
import { registrarFuentes } from '../../plantilla/fuentes';
import { ANCHO_TEXTO_REPORTE } from '../../plantilla/tokens';
import { datosArbolReporte, datosTarjeta, type ModeloArbolReporte } from '../datosReporte';
import { leerMedidoresReporte, type MedidoresReporte } from '../renglonesReporte';

/** Lo más lejos del borde que puede quedar el texto de prueba, en pt. */
const MARGEN = 0.5;

/** Más cerca del borde, el float32 de yoga decide para cualquier lado. */
const AL_RAS = 0.01;

const LADO = { adentro: 'adentro', afuera: 'afuera' } as const;
type Lado = (typeof LADO)[keyof typeof LADO];

const CODIGO = 'P1';

/** Una caja por texto que se parte o se corta; la de grupo es igual a la de parcela. */
const CAJAS = {
  idFila: { letra: 'idFila', ancho: ANCHO_TEXTO_REPORTE.listado.idArbol, mono: true },
  idTarjeta: { letra: 'idTarjeta', ancho: ANCHO_TEXTO_REPORTE.tarjeta.idArbol, mono: true },
  especieFila: { letra: 'fila', ancho: ANCHO_TEXTO_REPORTE.listado.especie },
  nombreFila: { letra: 'fila', ancho: ANCHO_TEXTO_REPORTE.listado.parcela, conCodigo: true },
  especieTarjeta: { letra: 'especieTarjeta', ancho: ANCHO_TEXTO_REPORTE.tarjeta.especie },
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

const CARACTER_ID = 'L';

/** En mono: los caracteres que entran, adentro, y uno más, afuera. */
function alBordeMono(medir: Medidor, objetivo: number, lado: Lado) {
  const entran = Math.floor((objetivo - AL_RAS) / medir(CARACTER_ID));
  const texto = CARACTER_ID.repeat(lado === LADO.adentro ? entran : entran + 1);
  const signo = lado === LADO.adentro ? 1 : -1;
  return { texto, distancia: signo * (objetivo - medir(texto)) };
}

/** El ancho de lo que va en el renglón detrás del código, si lo lleva. */
function objetivoDe(caja: Caja, medidores: MedidoresReporte): number {
  const { letra, ancho } = CAJAS[caja];
  if (!('conCodigo' in CAJAS[caja])) return ancho;
  return ancho - medidores.codigo(CODIGO) - medidores[letra](TEXTO_ARBOL.separadorCodigo);
}

const margenDe = (caja: Caja, medidores: MedidoresReporte) =>
  'mono' in CAJAS[caja] ? medidores[CAJAS[caja].letra](CARACTER_ID) : MARGEN;

function textosAlBorde(medidores: MedidoresReporte, lado: Lado) {
  const cajas = Object.keys(CAJAS) as Caja[];
  return Object.fromEntries(
    cajas.map((caja) => {
      const medir = medidores[CAJAS[caja].letra];
      const buscar = 'mono' in CAJAS[caja] ? alBordeMono : alBorde;
      return [caja, buscar(medir, objetivoDe(caja, medidores), lado)];
    }),
  ) as Record<Caja, ReturnType<typeof alBorde>>;
}

type Textos = { idArbol: string; especie: string; nombre: string };

const conTextos = <T extends ModeloArbolReporte>(
  modelo: T,
  { idArbol, especie, nombre }: Textos,
) => ({
  ...modelo,
  idArbol,
  especie: { ...modelo.especie, titulo: especie },
  parcela: { codigo: CODIGO, nombre },
});

/** Una tarjeta y una fila, cada texto en un renglón. */
function renderizar(textos: Record<Caja, { texto: string }>) {
  const arbol = arbolParaFicha({ fotoUrl: 'p/arbol.jpg' });
  const enFila = { idArbol: textos.idFila, especie: textos.especieFila, nombre: textos.nombreFila };
  const enTarjeta = {
    idArbol: textos.idTarjeta,
    especie: textos.especieTarjeta,
    nombre: textos.nombreTarjeta,
  };
  const deCaja = (caja: typeof enFila) => ({
    idArbol: caja.idArbol.texto,
    especie: caja.especie.texto,
    nombre: caja.nombre.texto,
  });
  return renderizarSinPartir({
    tarjetas: [conTextos(datosTarjeta(arbol, LISTA, COLOR_DE), deCaja(enTarjeta))],
    listado: [conTextos(datosArbolReporte(arbol, COLOR_DE), deCaja(enFila))],
  });
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
])('al borde, $lado de cada caja, $cuenta', async ({ lado, entero }) => {
  const textos = textosAlBorde(medidores, lado);
  const pdf = await renderizar(textos);
  for (const [caja, { texto, distancia }] of Object.entries(textos)) {
    expect(distancia, caja).toBeLessThanOrEqual(margenDe(caja as Caja, medidores));
    expect(saleEntero(pdf, texto), caja).toBe(entero);
  }
});
