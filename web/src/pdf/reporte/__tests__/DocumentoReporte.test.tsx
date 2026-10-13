// @vitest-environment node
// node y no jsdom: con jsdom, pdfkit no reconoce los Buffer de las imágenes (otro realm).
// Lo que no depende de si el texto largo va entero o cortado: árboles de un renglón.
import { arbolParaFicha } from '../../../test/fabricas';
import { FUENTES_NODE, paginasDelPdf } from '../../../test/pdfNode';
import { hojasQueOcupa } from '../../../test/hojasReporte';
import {
  CORTO,
  enUnRenglon,
  LISTA,
  muchos,
  PEOR_CASO,
  renderizar,
  repartoDe,
  SIN_NADA,
} from '../../../test/reportePdf';
import { textosDelPdf } from '../../../test/textoPdf';
import { ESTADO_FOTO, type FotoPdf } from '../../estadoFoto';
import { registrarFuentes } from '../../plantilla/fuentes';
import { MEDIDA_REPORTE } from '../../plantilla/tokens';
import { NIVELES_DE_ESCALON } from '../Escalon';
import { Listado } from '../Listado';
import { estimarReporte, FILAS_POR_HOJA, MODO_REPORTE, TARJETAS_POR_HOJA } from '../planReporte';
import { GrillaTarjetas } from '../Tarjeta';

const NO_DISPONIBLE: FotoPdf = { estado: ESTADO_FOTO.noDisponible };

beforeAll(() => registrarFuentes(FUENTES_NODE));

const ocurrencias = (textos: string[], buscado: string) =>
  textos.filter((texto) => texto === buscado).length;

test('la hoja es A4 horizontal: más ancha que alta', async () => {
  const pdf = await renderizar([PEOR_CASO]);
  const [, ancho, alto] = pdf.toString('latin1').match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/)!;
  expect([Math.round(Number(ancho)), Math.round(Number(alto))]).toEqual([842, 595]);
});

const tarjetas = (cantidad: number) => enUnRenglon(repartoDe(muchos(cantidad, CORTO))).tarjetas;
const filas = (cantidad: number) =>
  enUnRenglon(repartoDe(muchos(cantidad, CORTO), MODO_REPORTE.sinFotos)).listado;

test('6 tarjetas de un renglón entran justas en una hoja, sin partirse', async () => {
  expect(await hojasQueOcupa(<GrillaTarjetas tarjetas={tarjetas(TARJETAS_POR_HOJA)} />)).toBe(1);
  // Una fila más ya no entra: la prueba detecta el desborde.
  const deMas = tarjetas(TARJETAS_POR_HOJA + MEDIDA_REPORTE.columnasTarjetas);
  expect(await hojasQueOcupa(<GrillaTarjetas tarjetas={deMas} />)).toBe(2);
});

test('las filas de un renglón entran justas en una hoja, debajo del encabezado', async () => {
  expect(await hojasQueOcupa(<Listado filas={filas(FILAS_POR_HOJA)} />)).toBe(1);
  expect(await hojasQueOcupa(<Listado filas={filas(FILAS_POR_HOJA + 1)} />)).toBe(2);
});

test('6 tarjetas llenan una hoja y la séptima abre otra', async () => {
  expect(paginasDelPdf(await renderizar(muchos(TARJETAS_POR_HOJA, CORTO)))).toBe(1);
  expect(paginasDelPdf(await renderizar(muchos(TARJETAS_POR_HOJA + 1, CORTO)))).toBe(2);
});

test('las tarjetas van primero y el listado después, cada uno en el orden de entrada', async () => {
  const arbol = (idArbol: string, fotoUrl: string | null) =>
    arbolParaFicha({ id: idArbol, idArbol, fotoUrl });
  const arboles = [
    arbol('S1-SS26', null),
    arbol('F1-SS26', 'p/f1.jpg'),
    arbol('S2-SS26', null),
    arbol('F2-SS26', 'p/f2.jpg'),
  ];
  const pdf = await renderizar(arboles);
  const textos = textosDelPdf(pdf);
  const posiciones = ['F1-SS26', 'F2-SS26', 'S1-SS26', 'S2-SS26'].map((id) => textos.indexOf(id));
  expect(paginasDelPdf(pdf)).toBe(2);
  expect(posiciones.every((posicion) => posicion >= 0)).toBe(true);
  expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));
});

test('una tarjeta sin especie, parcela, posición ni GPS sale con N/N y guiones', async () => {
  const pdf = await renderizar([{ ...SIN_NADA, fotoUrl: 'p/arbol.jpg' }]);
  const textos = textosDelPdf(pdf);
  expect(paginasDelPdf(pdf)).toBe(1);
  expect(textos).toEqual(expect.arrayContaining(['N/N · Sin identificar']));
  // Parcela, posición y GPS.
  expect(ocurrencias(textos, '—')).toBe(3);
});

test('el listado sigue en otra hoja, con el encabezado de columnas en cada una', async () => {
  const pdf = await renderizar(muchos(FILAS_POR_HOJA * 3 + 1, { ...CORTO, fotoUrl: null }));
  expect(paginasDelPdf(pdf)).toBe(4);
  expect(ocurrencias(textosDelPdf(pdf), 'ID ÁRBOL')).toBe(4);
});

test('7 tarjetas y 40 filas de un renglón: las hojas que estima el modal, y el pie', async () => {
  const arboles = [...muchos(7, CORTO), ...muchos(40, { ...SIN_NADA, fotoUrl: null })];
  const pdf = await renderizar(arboles);
  const { hojas } = estimarReporte({ total: 47, conFoto: 7, modo: MODO_REPORTE.conFotos });
  expect(paginasDelPdf(pdf)).toBe(hojas);
  expect(textosDelPdf(pdf)).toEqual(
    expect.arrayContaining([
      'Reporte de árboles · 47 árboles',
      'Emitido el 12/10/2026 · Página 4 de 4',
    ]),
  );
});

test('con más hojas que niveles de escalón, cada hoja del plan es una del PDF', async () => {
  const hojas = NIVELES_DE_ESCALON + 1;
  const pdf = await renderizar(
    muchos(FILAS_POR_HOJA * (hojas - 1) + 1, { ...SIN_NADA, fotoUrl: null }),
  );
  expect(paginasDelPdf(pdf)).toBe(hojas);
  expect(ocurrencias(textosDelPdf(pdf), 'ID ÁRBOL')).toBe(hojas);
}, 30_000);

test('una foto que no se bajó deja «Foto no disponible» y el PDF sale', async () => {
  const pdf = await renderizar(muchos(2), MODO_REPORTE.conFotos, (indice) =>
    indice === 0 ? NO_DISPONIBLE : LISTA,
  );
  expect(paginasDelPdf(pdf)).toBe(1);
  expect(ocurrencias(textosDelPdf(pdf), 'Foto no disponible')).toBe(1);
});

test('sin fotos, todo va al listado aunque los árboles tengan foto', async () => {
  const pdf = await renderizar(muchos(TARJETAS_POR_HOJA), MODO_REPORTE.sinFotos);
  const textos = textosDelPdf(pdf);
  expect(paginasDelPdf(pdf)).toBe(1);
  // Solo el encabezado de columnas: ninguna tarjeta repite el rótulo.
  expect(ocurrencias(textos, 'PARCELA')).toBe(1);
  // El ID más largo entra entero en su columna, en un renglón.
  expect(ocurrencias(textos, 'LPN123L23BANCHC1234-SS2026B')).toBe(TARJETAS_POR_HOJA);
  expect(textos).toEqual(expect.arrayContaining(['1234', '14/09/2026', '-27.360123, -55.897441']));
});

test('ni ID Global ni técnico (#822)', async () => {
  const textos = textosDelPdf(await renderizar([PEOR_CASO, { ...SIN_NADA, fotoUrl: null }]));
  expect(textos.join(' ')).not.toMatch(/ID Global|Técnico/i);
});
