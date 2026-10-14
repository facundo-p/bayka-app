// @vitest-environment node
import { FUENTES_NODE } from '../../../test/pdfNode';
import { anchoDelRenglon, renglonesDeTextkit } from '../../../test/textkit';
import type { Medidor } from '../medirTexto';
import { leerFuente, medidorRegistrado, registrarFuentes } from '../fuentes';
import { partidorConMemoria, partirTexto } from '../partirTexto';
import { LETRA_REPORTE, TAMANO_TEXTO } from '../tokens';

/** Un pt por unidad UTF-16: un emoji mide 2. */
const porUnidad: Medidor = (texto) => texto.length;

test('un texto que entra sale igual, en un renglón y con sus espacios', () => {
  expect(partirTexto('Loma  Norte', porUnidad, 11.5)).toEqual(['Loma  Norte']);
});

test('uno vacío sale en un renglón vacío', () => {
  expect(partirTexto('', porUnidad, 5)).toEqual(['']);
});

test('el que no entra se parte por palabra, con todo lo que entra en cada renglón', () => {
  expect(partirTexto('Loma de los Paraísos Norte', porUnidad, 11.5)).toEqual([
    'Loma de los',
    'Paraísos',
    'Norte',
  ]);
});

// textkit suma en otro orden: al ras del borde, el redondeo lo puede dejar afuera.
test('un renglón que llega justo al borde no entra', () => {
  expect(partirTexto('Loma de los', porUnidad, 11)).toEqual(['Loma de', 'los']);
});

test('partido, los espacios seguidos quedan en uno', () => {
  expect(partirTexto('  Loma   de  los  ', porUnidad, 8.5)).toEqual(['Loma de', 'los']);
});

test('la palabra que no entra sola se parte por grafema', () => {
  expect(partirTexto('Itaembé grande', porUnidad, 4.5)).toEqual(['Itae', 'mbé', 'gran', 'de']);
});

test.each([
  ['un emoji', 'ab😀cdef', 4.5, ['ab😀', 'cdef']],
  ['una letra de su tilde combinada', 'País', 3.5, ['Pa', 'ís']],
])('no separa %s', (_, texto, ancho, esperado) => {
  expect(partirTexto(texto, porUnidad, ancho)).toEqual(esperado);
});

test.each([0, -3])('con ancho %s, cada renglón lleva al menos un grafema', (ancho) => {
  expect(partirTexto('Loma', porUnidad, ancho)).toEqual(['L', 'o', 'm', 'a']);
});

describe('con un primer renglón más angosto, detrás de un código', () => {
  test('el primero lleva lo que le entra y los demás tienen todo el ancho', () => {
    expect(partirTexto('Loma de los Paraísos', porUnidad, 11.5, 6.5)).toEqual([
      'Loma',
      'de los',
      'Paraísos',
    ]);
  });

  test('si ni la primera palabra entra, arranca en el segundo', () => {
    expect(partirTexto('Paraísos Norte', porUnidad, 9, 4)).toEqual(['', 'Paraísos', 'Norte']);
  });

  test('una palabra que no entra en ningún renglón se parte desde el primero', () => {
    expect(partirTexto('Itaembé', porUnidad, 4.5, 2.5)).toEqual(['It', 'aemb', 'é']);
  });

  test('si el código ocupa todo, el nombre arranca en el segundo', () => {
    expect(partirTexto('Loma', porUnidad, 9, -2)).toEqual(['', 'Loma']);
  });
});

/** La «m» mide 3 y la «i», medio: anchos que no crecen parejo con la cantidad de letras. */
const desparejo: Medidor = (texto) =>
  [...texto].reduce((ancho, letra) => ancho + (letra === 'm' ? 3 : letra === 'i' ? 0.5 : 1), 0);

test('con anchos desparejos, cada renglón entra y la palabra siguiente ya no le entra', () => {
  const texto = 'mimo de mimbre mínimo y mimosa mía';
  // Desde la palabra más ancha: ninguna se parte por grafema.
  for (let ancho = 10; ancho <= desparejo(texto); ancho += 0.25) {
    const renglones = partirTexto(texto, desparejo, ancho);
    expect(renglones.join(' ')).toBe(texto);
    renglones.forEach((renglon, indice) => {
      expect(desparejo(renglon)).toBeLessThan(ancho);
      const siguiente = renglones[indice + 1]?.split(' ')[0];
      if (siguiente) expect(desparejo(`${renglon} ${siguiente}`)).toBeGreaterThanOrEqual(ancho);
    });
  }
});

test('el partidor con memoria parte igual, sin volver a medir lo que ya partió', () => {
  const medir = vi.fn(porUnidad);
  const partir = partidorConMemoria(medir);
  const esperado = ['Loma de los', 'Paraísos'];
  expect(partir('Loma de los Paraísos', 11.5)).toEqual(esperado);
  const medidas = medir.mock.calls.length;
  expect(partir('Loma de los Paraísos', 11.5)).toEqual(esperado);
  expect(medir).toHaveBeenCalledTimes(medidas);
  expect(partir('Loma de los Paraísos', 11.5, 4.5)).toEqual(['Loma', 'de los', 'Paraísos']);
});

const NOMBRE_LARGO = 'Loma de los Paraísos Norte, ladera del arroyo Itaembé y el bañado grande';

beforeAll(() => registrarFuentes(FUENTES_NODE));

// Si un renglón no le entrara, textkit lo partiría de nuevo o le achicaría los espacios.
test.each([60, 90, 116, 167])(
  'partido a %s pt, textkit deja cada renglón como está, a ancho natural',
  async (ancho) => {
    const letra = LETRA_REPORTE.fila;
    const fuente = await leerFuente(letra);
    const medir = await medidorRegistrado(letra);
    const estilo = { tamano: TAMANO_TEXTO.filaListado };
    for (const renglon of partirTexto(NOMBRE_LARGO, medir, ancho)) {
      const [armado, ...demas] = renglonesDeTextkit(renglon, fuente, estilo, { ancho });
      expect(demas).toEqual([]);
      expect(armado.string).toBe(renglon);
      expect(anchoDelRenglon(armado)).toBeCloseTo(medir(renglon), 6);
    }
  },
);
