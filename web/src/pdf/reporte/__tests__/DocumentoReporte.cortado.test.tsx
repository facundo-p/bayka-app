// @vitest-environment node
// Con el texto largo cortado en un renglón con «…».
import { FUENTES_NODE, paginasDelPdf } from '../../../test/pdfNode';
import { renderizarSinPartir } from '../../../test/hojasReporte';
import {
  DE_60,
  muchos,
  PEOR_CASO,
  renderizar,
  repartoDe,
  SIN_NADA,
} from '../../../test/reportePdf';
import { textosConGlifosCorridos, textosDelPdf } from '../../../test/textoPdf';
import { registrarFuentes } from '../../plantilla/fuentes';
import { estimarReporte, MODO_REPORTE } from '../planReporte';

vi.mock('../../plantilla/textoLargo', () => ({ CORTAR_TEXTO_LARGO: true }));

beforeAll(() => registrarFuentes(FUENTES_NODE));

test('en la tarjeta del peor caso se ven todos los datos y lo largo termina en «…»', async () => {
  const textos = textosDelPdf(await renderizar([PEOR_CASO]));
  expect(textos).toEqual(
    expect.arrayContaining([
      'LPN123L23BANCHC1234-SS2026B',
      'LPN123',
      'L23B',
      '1234',
      '14/09/2026',
      '-27.360123, -55.897441',
      'Loma de los Paraísos Norte, lad…',
    ]),
  );
  const especie = textos.find((texto) => texto.startsWith('ANCHC · Anchico'));
  expect(especie).toMatch(/…$/);
});

/** Los renglones cortados con algún glifo corrido: los que textkit apretó. */
const cortadosApretados = (pdf: Buffer) =>
  textosConGlifosCorridos(pdf).filter((texto) => texto.endsWith('…'));

test.each([
  { donde: 'las tarjetas', modo: MODO_REPORTE.conFotos },
  { donde: 'el listado', modo: MODO_REPORTE.sinFotos },
])(
  'en $donde, los nombres de 60 caracteres terminan en «…» sin apretar los espacios',
  async ({ modo }) => {
    const pdf = await renderizar(DE_60, modo);
    const cortados = textosDelPdf(pdf).filter((texto) => texto.endsWith('…'));
    // Especie, parcela y grupo de cada árbol.
    expect(cortados).toHaveLength(3 * DE_60.length);
    expect(cortados.filter((texto) => texto.startsWith('ANCHC · '))).toHaveLength(DE_60.length);
    expect(cortadosApretados(pdf)).toEqual([]);
  },
);

// Si react-pdf cambiara cómo anota los avances, la red de arriba no vería nada.
test('control: sin el corte, textkit aprieta esos nombres y la red lo ve', async () => {
  const { tarjetas } = repartoDe(DE_60);
  const { listado } = repartoDe(DE_60, MODO_REPORTE.sinFotos);
  expect(cortadosApretados(await renderizarSinPartir({ tarjetas, listado }))).not.toEqual([]);
});

test('7 tarjetas y 40 filas del peor caso: las hojas que estima el modal', async () => {
  const arboles = [...muchos(7), ...muchos(40, { ...PEOR_CASO, fotoUrl: null })];
  const pdf = await renderizar(arboles);
  const { hojas } = estimarReporte({ total: 47, conFoto: 7, modo: MODO_REPORTE.conFotos });
  expect(paginasDelPdf(pdf)).toBe(hojas);
  expect(textosDelPdf(pdf)).toContain('Emitido el 12/10/2026 · Página 4 de 4');
});

test('una tarjeta sin especie ni parcela no cambia', async () => {
  const pdf = await renderizar([{ ...SIN_NADA, fotoUrl: 'p/arbol.jpg' }]);
  expect(textosDelPdf(pdf)).toEqual(expect.arrayContaining(['N/N · Sin identificar']));
});
