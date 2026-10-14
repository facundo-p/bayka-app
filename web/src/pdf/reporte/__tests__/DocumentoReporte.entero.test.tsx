// @vitest-environment node
// Con el texto largo entero, en los renglones que haga falta (#876).
import { View } from '@react-pdf/renderer';
import type { ArbolParaFicha } from '../../../queries/fichasQueries';
import { arbolParaFicha } from '../../../test/fabricas';
import { FUENTES_NODE, paginasDelPdf } from '../../../test/pdfNode';
import { hojasQueOcupa, renderizarSinPartir } from '../../../test/hojasReporte';
import {
  CORTO,
  DE_60,
  enRenglones,
  muchos,
  PEOR_CASO,
  renderizar,
  repartoDe,
} from '../../../test/reportePdf';
import { textosConGlifosCorridos, textosDelPdf } from '../../../test/textoPdf';
import { registrarFuentes } from '../../plantilla/fuentes';
import { CUERPO_REPORTE, MEDIDA_REPORTE } from '../../plantilla/tokens';
import { ALTOS_EN_RENGLONES, altoFila, altoTarjeta } from '../altosReporte';
import { Listado } from '../Listado';
import { estimarReporte, MODO_REPORTE, paginarReporte } from '../planReporte';
import type { RepartoEnRenglones } from '../renglonesReporte';
import { GrillaTarjetas } from '../Tarjeta';

vi.mock('../../plantilla/textoLargo', () => ({ CORTAR_TEXTO_LARGO: false }));

beforeAll(() => registrarFuentes(FUENTES_NODE));

const MODOS = [
  { donde: 'las tarjetas', modo: MODO_REPORTE.conFotos },
  { donde: 'el listado', modo: MODO_REPORTE.sinFotos },
] as const;

/** Los textos partidos de cada árbol del bloque, con el nombre original de cada uno. */
function textosPartidos({ tarjetas, listado }: RepartoEnRenglones) {
  return [...tarjetas, ...listado].flatMap(({ especie, parcela, grupo }) => [
    especie.titulo,
    ...[parcela, grupo].flatMap((entidad) => (entidad ? [entidad.nombre] : [])),
  ]);
}

/** Cada renglón se dibuja, ninguno apretado, y juntos rearman el texto. */
async function salenEnteros(arboles: ArbolParaFicha[], modo: (typeof MODOS)[number]['modo']) {
  const pdf = await renderizar(arboles, modo);
  const [dibujados, apretados] = [textosDelPdf(pdf), textosConGlifosCorridos(pdf)];
  const partidos = textosPartidos(await enRenglones(repartoDe(arboles, modo)));
  for (const renglones of partidos) {
    expect(renglones.length).toBeGreaterThan(1);
    for (const renglon of renglones.filter(Boolean)) {
      expect(dibujados).toContain(renglon);
      expect(apretados).not.toContain(renglon);
    }
  }
  return { pdf, partidos };
}

test.each(MODOS)('en $donde, el peor caso sale entero, en renglones', async ({ modo }) => {
  const { partidos } = await salenEnteros([PEOR_CASO], modo);
  expect(partidos.map((renglones) => renglones.join(' '))).toEqual([
    'ANCHC · Anchico colorado de los montes misioneros del Alto Paraná',
    'Loma de los Paraísos Norte, ladera del arroyo Itaembé',
    'Línea 23B del sector bajo del bañado grande',
  ]);
});

test.each(MODOS)('en $donde, los nombres de 60 caracteres salen enteros', async ({ modo }) => {
  const { pdf } = await salenEnteros(DE_60, modo);
  expect(textosDelPdf(pdf).some((texto) => texto.endsWith('…'))).toBe(false);
});

const PALABRA_LARGA = 'Ibirapitamirikuéguasuretáopáreguaraníchokokueopomboapytã';
const CON_PALABRA_LARGA = arbolParaFicha({
  ...PEOR_CASO,
  parcela: { codigo: 'P1', nombre: `Loma ${PALABRA_LARGA}` },
});

test.each(MODOS)('en $donde, una palabra más ancha que su caja se parte', async ({ modo }) => {
  const pdf = await renderizar([CON_PALABRA_LARGA], modo);
  const textos = textosDelPdf(pdf).filter((texto) => /Ibira|tã$/.test(texto));
  expect(textos.length).toBeGreaterThan(1);
  expect(textosConGlifosCorridos(pdf).filter((texto) => textos.includes(texto))).toEqual([]);
});

// Si react-pdf cambiara cómo anota los avances, la red de arriba no vería nada.
test('control: sin partir, textkit aprieta la palabra que no entra y la red lo ve', async () => {
  const { tarjetas } = repartoDe([CON_PALABRA_LARGA]);
  const { listado } = repartoDe([CON_PALABRA_LARGA], MODO_REPORTE.sinFotos);
  const apretados = textosConGlifosCorridos(await renderizarSinPartir({ tarjetas, listado }));
  expect(apretados.filter((texto) => texto.includes('Ibira'))).not.toEqual([]);
});

/** Un bloque de `alto` pt antes del contenido. */
const relleno = (alto: number) => <View style={{ height: alto }} />;

/** Lo que mide de verdad, a medio punto: con medio más de lugar entra, y con medio menos no. */
const MEDIO_PUNTO = 0.5;

describe('el alto que calcula el plan es el del PDF', () => {
  test.each([
    ['de un renglón', CORTO],
    ['del peor caso', PEOR_CASO],
    ['con una palabra larga', CON_PALABRA_LARGA],
  ])('una fila %s', async (_, arbol) => {
    const [fila] = (await enRenglones(repartoDe([arbol], MODO_REPORTE.sinFotos))).listado;
    const libre = CUERPO_REPORTE.alto - MEDIDA_REPORTE.altoEncabezadoListado - altoFila(fila);
    const conLugar = (
      <>
        {relleno(libre - MEDIO_PUNTO)}
        <Listado filas={[fila]} />
      </>
    );
    const sinLugar = (
      <>
        {relleno(libre + MEDIO_PUNTO)}
        <Listado filas={[fila]} />
      </>
    );
    expect([await hojasQueOcupa(conLugar), await hojasQueOcupa(sinLugar)]).toEqual([1, 2]);
  });

  test.each([
    ['de un renglón', CORTO],
    ['del peor caso', PEOR_CASO],
    ['con una palabra larga', CON_PALABRA_LARGA],
  ])('una tarjeta %s', async (_, arbol) => {
    const [tarjeta] = (await enRenglones(repartoDe([arbol]))).tarjetas;
    const libre = CUERPO_REPORTE.alto - altoTarjeta(tarjeta);
    const conLugar = (
      <>
        {relleno(libre - MEDIO_PUNTO)}
        <GrillaTarjetas tarjetas={[tarjeta]} />
      </>
    );
    const sinLugar = (
      <>
        {relleno(libre + MEDIO_PUNTO)}
        <GrillaTarjetas tarjetas={[tarjeta]} />
      </>
    );
    expect([await hojasQueOcupa(conLugar), await hojasQueOcupa(sinLugar)]).toEqual([1, 2]);
  });
});

test('las hojas salen como dice el plan, y el pie cuenta las reales', async () => {
  const arboles = [
    ...muchos(9),
    ...DE_60,
    ...muchos(5, CORTO),
    ...muchos(40, { ...PEOR_CASO, fotoUrl: null }),
    ...DE_60.map((arbol) => ({ ...arbol, id: `${arbol.id}-l`, fotoUrl: null })),
  ];
  const pdf = await renderizar(arboles);
  const hojas = paginarReporte(await enRenglones(repartoDe(arboles)), ALTOS_EN_RENGLONES).length;
  const conFoto = arboles.filter((arbol) => arbol.fotoUrl).length;
  const estimado = estimarReporte({ total: arboles.length, conFoto, modo: MODO_REPORTE.conFotos });
  expect(paginasDelPdf(pdf)).toBe(hojas);
  expect(textosDelPdf(pdf)).toContain(`Emitido el 12/10/2026 · Página ${hojas} de ${hojas}`);
  // La estimación del modal cuenta todo en un renglón: es un piso, y lo avisa.
  expect(estimado.hojas).toBeLessThan(hojas);
  expect(estimado.esPiso).toBe(true);
  expect(estimarReporte({ total: 0, conFoto: 0, modo: MODO_REPORTE.conFotos }).esPiso).toBe(false);
});
