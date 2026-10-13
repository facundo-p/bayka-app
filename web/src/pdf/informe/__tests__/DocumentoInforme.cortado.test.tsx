// @vitest-environment node
// Con el texto largo cortado en un renglón con «…» (#883).
import { entradaInforme, MEDIDORES_INFORME_EN_CERO } from '../../../test/informePdf';
import { paginasDelPdf } from '../../../test/pdfNode';
import { armarInforme } from '../../../test/renderInforme';
import { textosConGlifosCorridos } from '../../../test/textoPdf';
import type { InformeConMapa } from '../renglonesInforme';

vi.mock('../../plantilla/textoLargo', () => ({ CORTAR_TEXTO_LARGO: true }));

const LARGOS = { parcelas: 4, nn: 3, largos: true, codigosLargos: true } as const;

const textosEnRenglones = ({ linea, especies, mapa }: InformeConMapa) => [
  linea,
  ...especies.filas.map(({ titulo }) => titulo),
  ...mapa.leyenda.map(({ texto }) => texto),
];

/** Los renglones cortados con algún glifo corrido: los que textkit apretó. */
const cortadosApretados = (pdf: Buffer) =>
  textosConGlifosCorridos(pdf).filter((texto) => texto.endsWith('…'));

test('la línea, los nombres y los códigos largos terminan en «…», sin apretar los espacios', async () => {
  const { pdf, textos, modelo } = await armarInforme(entradaInforme({ ...LARGOS, especies: 3 }));
  for (const renglones of textosEnRenglones(modelo as InformeConMapa)) {
    expect(renglones).toHaveLength(1);
  }
  const cortados = textos.filter((texto) => texto.endsWith('…'));
  // La línea, los tres nombres y sus tres códigos.
  expect(cortados).toHaveLength(7);
  expect(cortados.filter((texto) => texto.startsWith('LAPCOLORADO · Lapacho'))).toHaveLength(1);
  expect(cortadosApretados(pdf)).toEqual([]);
});

// Si react-pdf cambiara cómo anota los avances, la red de arriba no vería nada.
test('control: si el corte lo hace textkit, aprieta esos textos y la red lo ve', async () => {
  const entrada = entradaInforme({ ...LARGOS, especies: 3 });
  const { pdf } = await armarInforme(entrada, { medidores: MEDIDORES_INFORME_EN_CERO });
  expect(cortadosApretados(pdf)).not.toEqual([]);
});

test.each([4, 10, 40])(
  'con %i especies de nombre largo, las mismas hojas y el mismo plan que con nombres cortos',
  async (especies) => {
    const largo = await armarInforme(entradaInforme({ ...LARGOS, especies }));
    const corto = await armarInforme(entradaInforme({ parcelas: 4, nn: 3, especies }));
    expect(paginasDelPdf(largo.pdf)).toBe(paginasDelPdf(corto.pdf));
    expect(largo.plan).toEqual(corto.plan);
  },
);
