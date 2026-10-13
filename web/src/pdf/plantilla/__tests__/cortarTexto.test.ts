// @vitest-environment node
// react-pdf no expone el ancho que calcula textkit: se arma el renglón con su
// motor y las opciones de @react-pdf/layout.
import layoutEngine, {
  bidi,
  fontSubstitution,
  fromFragments,
  justification,
  linebreaker,
  scriptItemizer,
  textDecoration,
  wordHyphenation,
  type AttributedString,
} from '@react-pdf/textkit';
import { FUENTES_NODE } from '../../../test/pdfNode';
import {
  conMemoria,
  cortadorConMemoria,
  cortarTexto,
  medidorDeFuente,
  type EstiloMedido,
  type FuenteMedible,
  type Medidor,
} from '../cortarTexto';
import { comoMedible, leerFuente, registrarFuentes } from '../fuentes';
import { FUENTE_PDF, MEDIDA_REPORTE, PESO_FUENTE, TAMANO_TEXTO } from '../tokens';

/** Un pt por unidad UTF-16: el «…» mide 1 y un emoji, 2. */
const porUnidad: Medidor = (texto) => texto.length;

test('un texto que entra sale entero', () => {
  expect(cortarTexto('Loma', porUnidad, 4.5)).toBe('Loma');
});

// textkit suma en otro orden: al ras del borde, el redondeo lo puede dejar afuera.
test('uno que llega justo al borde se corta', () => {
  expect(cortarTexto('Loma', porUnidad, 4)).toBe('Lo…');
});

test('el que no entra sale con «…», con lo más largo que entra', () => {
  expect(cortarTexto('Loma de los Paraísos', porUnidad, 10.5)).toBe('Loma de l…');
});

test('sin el espacio de antes del «…»', () => {
  expect(cortarTexto('Loma de los', porUnidad, 6)).toBe('Loma…');
});

test.each([10, 0])('un texto vacío sale vacío, con ancho %s', (ancho) => {
  expect(cortarTexto('', porUnidad, ancho)).toBe('');
});

test('si solo entra el «…», sale el «…»', () => {
  expect(cortarTexto('Loma', porUnidad, 1.5)).toBe('…');
});

test.each([0, -3])('con ancho %s no entra ni el «…», y queda el «…»: el corte se nota', (ancho) => {
  expect(cortarTexto('Loma', porUnidad, ancho)).toBe('…');
});

test.each([
  ['un emoji', 'ab😀cd', 4.5, 'ab…'],
  ['un emoji con tono de piel', 'Hola 👋🏽 amigos', 8.5, 'Hola…'],
  ['una letra de su tilde combinada', 'Pai\u0301s', 4.5, 'Pa…'],
])('no separa %s', (_, texto, ancho, esperado) => {
  expect(cortarTexto(texto, porUnidad, ancho)).toBe(esperado);
});

test('sin Intl.Segmenter corta por punto de código: no parte un emoji, pero sí una tilde combinada', () => {
  vi.stubGlobal('Intl', { Segmenter: undefined });
  try {
    expect(cortarTexto('ab😀cd', porUnidad, 4.5)).toBe('ab…');
    expect(cortarTexto('Pai\u0301s', porUnidad, 4.5)).toBe('Pai…');
  } finally {
    vi.unstubAllGlobals();
  }
});

/** La «m» mide 3 y la «i», medio: anchos que no crecen parejo con la cantidad de letras. */
const desparejo: Medidor = (texto) =>
  [...texto].reduce((ancho, letra) => ancho + (letra === 'm' ? 3 : letra === 'i' ? 0.5 : 1), 0);

/**
 * Lo que tiene que dar, probando todos los cortes del más largo al más corto.
 * Lo que llega justo al borde no entra.
 */
function cortePorFuerzaBruta(texto: string, medir: Medidor, ancho: number): string {
  if (medir(texto) < ancho) return texto;
  for (let cantidad = texto.length - 1; cantidad >= 0; cantidad--) {
    const corte = `${texto.slice(0, cantidad).trimEnd()}…`;
    if (medir(corte) < ancho) return corte;
  }
  return '…';
}

test('con anchos desparejos, da el corte más largo que entra', () => {
  const texto = 'mimo de mimbre mínimo';
  for (let ancho = 0; ancho <= desparejo(texto); ancho += 0.25) {
    expect(cortarTexto(texto, desparejo, ancho)).toBe(cortePorFuerzaBruta(texto, desparejo, ancho));
  }
});

/** Medio em por glifo, en una fuente de 1000 unidades por em. */
const FUENTE_FALSA: FuenteMedible = {
  unitsPerEm: 1000,
  layout: (texto) => ({ positions: [...texto].map(() => ({ xAdvance: 500 })) }),
};

test('mide cada glifo escalado al tamaño, más el espaciado, también tras el último', () => {
  expect(medidorDeFuente(FUENTE_FALSA, { tamano: 10 })('abc')).toBe(15);
  expect(medidorDeFuente(FUENTE_FALSA, { tamano: 10, espaciado: 0.4 })('abc')).toBeCloseTo(16.2);
});

test('con memoria, mide cada texto una sola vez', () => {
  const medir = vi.fn(porUnidad);
  const conCache = conMemoria(medir);
  expect([conCache('Loma'), conCache('Loma'), conCache('Línea')]).toEqual([4, 4, 5]);
  expect(medir).toHaveBeenCalledTimes(2);
});

test('el cortador con memoria corta igual, sin volver a medir lo que ya cortó', () => {
  const medir = vi.fn(porUnidad);
  const cortar = cortadorConMemoria(medir);
  expect(cortar('Loma de los Paraísos', 10.5)).toBe('Loma de l…');
  const medidas = medir.mock.calls.length;
  expect(cortar('Loma de los Paraísos', 10.5)).toBe('Loma de l…');
  expect(medir).toHaveBeenCalledTimes(medidas);
  // Otro ancho vuelve a cortar, pero no vuelve a medir el texto entero.
  expect(cortar('Loma de los Paraísos', 6)).toBe('Loma…');
  expect(medir.mock.calls.filter(([texto]) => texto === 'Loma de los Paraísos')).toHaveLength(1);
});

const motorTextkit = layoutEngine({
  bidi,
  linebreaker,
  justification,
  textDecoration,
  scriptItemizer,
  wordHyphenation,
  fontSubstitution,
});

const OPCIONES_LAYOUT = { shrinkWhitespaceFactor: { before: -0.5, after: -0.5 } };

/** Sin caja que lo corte. */
const ANCHO_LIBRE = 10_000;

type Fuente = Awaited<ReturnType<typeof leerFuente>>;

/** El renglón que arma textkit con `maxLines: 1` y «…», como las celdas del reporte. */
function renglonDeTextkit(texto: string, fuente: Fuente, estilo: EstiloMedido, ancho: number) {
  const cadena = fromFragments([
    {
      string: texto,
      attributes: { font: [fuente], fontSize: estilo.tamano, characterSpacing: estilo.espaciado },
    },
  ]);
  const caja = { x: 0, y: 0, width: ancho, height: Infinity, maxLines: 1 };
  const [renglon] = motorTextkit(
    cadena,
    { ...caja, truncateMode: 'ellipsis' },
    OPCIONES_LAYOUT,
  ).flat();
  return renglon;
}

const anchoDelRenglon = (renglon: AttributedString) =>
  renglon.runs.flatMap((run) => run.positions ?? []).reduce((ancho, p) => ancho + p.xAdvance, 0);

beforeAll(() => registrarFuentes(FUENTES_NODE));

const NOMBRE_LARGO = 'Loma de los Paraísos Norte, ladera del arroyo Itaembé';
const NOMBRE_DE_60 = 'Un nombre de sesenta caracteres para la parcela de la lomita';

// Biolinum es la que trae kerning («AV», «To») y ligaduras («ffi»).
test.each([
  ['la fila del listado', FUENTE_PDF.cuerpo, PESO_FUENTE.regular, TAMANO_TEXTO.filaListado, 0],
  ['la especie de la tarjeta', FUENTE_PDF.cuerpo, PESO_FUENTE.semibold, TAMANO_TEXTO.especie, 0],
  ['el código', FUENTE_PDF.mono, PESO_FUENTE.regular, TAMANO_TEXTO.datoMono, 0],
  [
    'un rótulo espaciado',
    FUENTE_PDF.cuerpo,
    PESO_FUENTE.regular,
    TAMANO_TEXTO.etiqueta,
    MEDIDA_REPORTE.espaciadoMayusculas,
  ],
  ['un título con kerning', FUENTE_PDF.titulo, PESO_FUENTE.regular, TAMANO_TEXTO.encabezado, 0],
])('mide %s igual que textkit', async (_, familia, peso, tamano, espaciado) => {
  const fuente = await leerFuente({ fontFamily: familia, fontWeight: peso });
  const estilo = { tamano, espaciado };
  for (const texto of [NOMBRE_LARGO, 'AVATAR Tolva · ffi', '—AVAV', '(Lote A)', 'LPN123', '…']) {
    const textkit = anchoDelRenglon(renglonDeTextkit(texto, fuente, estilo, ANCHO_LIBRE));
    expect(medidorDeFuente(comoMedible(fuente), estilo)(texto)).toBeCloseTo(textkit, 6);
  }
});

// Si el corte se pasara, textkit lo volvería a cortar o le achicaría los espacios.
test.each([60, 90, 116, 167])('cortado a %s pt, textkit lo deja como está', async (ancho) => {
  const fuente = await leerFuente({
    fontFamily: FUENTE_PDF.cuerpo,
    fontWeight: PESO_FUENTE.regular,
  });
  const estilo = { tamano: TAMANO_TEXTO.filaListado };
  const medir = medidorDeFuente(comoMedible(fuente), estilo);
  for (const texto of [NOMBRE_LARGO, NOMBRE_DE_60]) {
    const corte = cortarTexto(texto, medir, ancho);
    const renglon = renglonDeTextkit(corte, fuente, estilo, ancho);
    expect(medir(corte)).toBeLessThanOrEqual(ancho);
    expect(renglon.string).toBe(corte);
    expect(anchoDelRenglon(renglon)).toBeCloseTo(medir(corte), 6);
  }
});
