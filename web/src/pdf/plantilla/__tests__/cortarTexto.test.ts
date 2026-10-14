// @vitest-environment node
import { FUENTES_NODE } from '../../../test/pdfNode';
import { anchoDelRenglon, renglonesDeTextkit } from '../../../test/textkit';
import { cortadorConMemoria, cortarTexto } from '../cortarTexto';
import type { FuenteLeida } from '../fuenteLeida';
import { leerFuente, registrarFuentes } from '../fuentes';
import { medidorDeFuente, type EstiloMedido, type Medidor } from '../medirTexto';
import { FUENTE_PDF, PESO_FUENTE, TAMANO_TEXTO } from '../tokens';

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

/** El renglón que arma textkit con `maxLines: 1` y «…», como las celdas del texto cortado. */
function renglonDeTextkit(texto: string, fuente: FuenteLeida, estilo: EstiloMedido, ancho: number) {
  const [renglon] = renglonesDeTextkit(texto, fuente, estilo, { ancho, unRenglon: true });
  return renglon;
}

beforeAll(() => registrarFuentes(FUENTES_NODE));

const NOMBRE_LARGO = 'Loma de los Paraísos Norte, ladera del arroyo Itaembé';
const NOMBRE_DE_60 = 'Un nombre de sesenta caracteres para la parcela de la lomita';

// Si el corte se pasara, textkit lo volvería a cortar o le achicaría los espacios.
test.each([60, 90, 116, 167])('cortado a %s pt, textkit lo deja como está', async (ancho) => {
  const fuente = await leerFuente({
    fontFamily: FUENTE_PDF.cuerpo,
    fontWeight: PESO_FUENTE.regular,
  });
  const estilo = { tamano: TAMANO_TEXTO.filaListado };
  const medir = medidorDeFuente(fuente, estilo);
  for (const texto of [NOMBRE_LARGO, NOMBRE_DE_60]) {
    const corte = cortarTexto(texto, medir, ancho);
    const renglon = renglonDeTextkit(corte, fuente, estilo, ancho);
    expect(medir(corte)).toBeLessThanOrEqual(ancho);
    expect(renglon.string).toBe(corte);
    expect(anchoDelRenglon(renglon)).toBeCloseTo(medir(corte), 6);
  }
});
