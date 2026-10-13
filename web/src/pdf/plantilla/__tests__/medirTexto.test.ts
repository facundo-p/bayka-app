// @vitest-environment node
import { FUENTES_NODE } from '../../../test/pdfNode';
import { anchoDelRenglon, renglonesDeTextkit } from '../../../test/textkit';
import type { FuenteLeida } from '../fuenteLeida';
import { FUENTE_RESPALDO, leerFuente, medidorRegistrado, registrarFuentes } from '../fuentes';
import { medidorDeFuente } from '../medirTexto';
import { FUENTE_PDF, MEDIDA_REPORTE, PESO_FUENTE, TAMANO_TEXTO } from '../tokens';

/** Medio em por glifo, en una fuente de 1000 unidades por em; tiene las letras de `glifos`. */
const fuenteFalsa = (glifos = 'abc'): FuenteLeida => ({
  unitsPerEm: 1000,
  layout: (texto) => ({ positions: [...texto].map(() => ({ xAdvance: 500 })) }),
  hasGlyphForCodePoint: (codigo) => glifos.includes(String.fromCodePoint(codigo)),
});

test('mide cada glifo escalado al tamaño, más el espaciado, también tras el último', () => {
  expect(medidorDeFuente(fuenteFalsa(), { tamano: 10 })('abc')).toBe(15);
  expect(medidorDeFuente(fuenteFalsa(), { tamano: 10, espaciado: 0.4 })('abc')).toBeCloseTo(16.2);
});

test('lo que la fuente no tiene lo mide con la de respaldo, en su escala', () => {
  // Un em por glifo en 2000 unidades: medio em, como la principal, pero en otra escala.
  const respaldo: FuenteLeida = {
    unitsPerEm: 2000,
    layout: (texto) => ({ positions: [...texto].map(() => ({ xAdvance: 3000 })) }),
    hasGlyphForCodePoint: () => true,
  };
  const medir = medidorDeFuente(fuenteFalsa('ab'), { tamano: 10 }, respaldo);
  expect(medir('ab')).toBe(10);
  expect(medir('aŠbŠŠ')).toBe(10 + 3 * 15);
});

/** Sin caja que lo corte. */
const ANCHO_LIBRE = 10_000;

beforeAll(() => registrarFuentes(FUENTES_NODE));

const NOMBRE_LARGO = 'Loma de los Paraísos Norte, ladera del arroyo Itaembé';

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
    const [renglon] = renglonesDeTextkit(texto, fuente, estilo, { ancho: ANCHO_LIBRE });
    const textkit = anchoDelRenglon(renglon);
    expect(medidorDeFuente(fuente, estilo)(texto)).toBeCloseTo(textkit, 6);
  }
});

// Poppins no tiene Š, ž, ƒ ni ĩ: textkit los dibuja con Helvetica, y la ĩ, que
// Helvetica tampoco tiene, con su glifo vacío.
test.each([
  ['regular', PESO_FUENTE.regular],
  ['semibold, que cae en Helvetica Bold', PESO_FUENTE.semibold],
])('con un carácter que Poppins no tiene, mide igual que textkit (%s)', async (_, peso) => {
  const letra = { fontFamily: FUENTE_PDF.cuerpo, fontWeight: peso, fontSize: TAMANO_TEXTO.dato };
  const fuente = await leerFuente(letra);
  const respaldo = [await leerFuente({ ...letra, fontFamily: FUENTE_RESPALDO })];
  const medir = await medidorRegistrado(letra);
  const estilo = { tamano: letra.fontSize };
  for (const texto of ['Šumava žlutý', 'ƒ Ñandutí', 'Yvyrapytã Ĩ', 'Š', '12 Šž', 'ŠAV To']) {
    const [renglon] = renglonesDeTextkit(texto, fuente, estilo, { ancho: ANCHO_LIBRE, respaldo });
    expect(medir(texto)).toBeCloseTo(anchoDelRenglon(renglon), 6);
  }
});
