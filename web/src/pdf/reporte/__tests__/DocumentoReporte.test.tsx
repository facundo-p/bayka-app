// @vitest-environment node
// node y no jsdom: con jsdom, pdfkit no reconoce los Buffer de las imágenes (otro realm).
import { Document, renderToBuffer } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { arbolParaFicha, coloresEnOrden } from '../../../test/fabricas';
import { FUENTES_NODE, LOGO_NODE, paginasDelPdf, PNG_DE_PRUEBA } from '../../../test/pdfNode';
import { textosDelPdf } from '../../../test/textoPdf';
import type { ArbolParaFicha } from '../../../queries/fichasQueries';
import { ESTADO_FOTO, type FotoPdf } from '../../estadoFoto';
import { registrarFuentes } from '../../plantilla/fuentes';
import { Hoja } from '../../plantilla/Hoja';
import { encabezadoDePlantacion } from '../../plantilla/textos';
import { MEDIDA_REPORTE, ORIENTACION_HOJA } from '../../plantilla/tokens';
import { datosArbolReporte, datosTarjeta } from '../datosReporte';
import { DocumentoReporte } from '../DocumentoReporte';
import { NIVELES_DE_ESCALON } from '../Escalon';
import { Listado } from '../Listado';
import {
  estimarReporte,
  FILAS_POR_HOJA,
  MODO_REPORTE,
  repartirArboles,
  TARJETAS_POR_HOJA,
  type ModoReporte,
} from '../planReporte';
import { GrillaTarjetas } from '../Tarjeta';

const COLOR_DE = coloresEnOrden('ANC');

const ENCABEZADO = encabezadoDePlantacion(
  { lugar: 'San Sebastián', periodo: '2025-2026', codigo: 'SS26' },
  'Bayka',
  LOGO_NODE,
);

const LISTA: FotoPdf = { estado: ESTADO_FOTO.lista, src: PNG_DE_PRUEBA };
const NO_DISPONIBLE: FotoPdf = { estado: ESTADO_FOTO.noDisponible };

// Todo lo que podría partirse en dos líneas, largo: si esto entra, cualquier hoja entra.
const PEOR_CASO = arbolParaFicha({
  subId: 'LPN12L10ANCH123',
  idArbol: 'LPN12L10ANCH123-SS2026B',
  posicion: 123,
  especie: {
    codigo: 'ANCHC',
    nombre: 'Anchico colorado de los montes misioneros del Alto Paraná',
    nombreCientifico: null,
    tipo: 'flora',
    subtipo: 'arbol',
  },
  parcela: { codigo: 'LPN12', nombre: 'Loma de los Paraísos Norte, ladera del arroyo Itaembé' },
  grupo: { codigo: 'L10', nombre: 'Línea 10 del sector bajo del bañado grande' },
  fotoUrl: 'p/arbol.jpg',
  createdAt: '2026-09-14T13:00:00Z',
  gps: { lat: -27.3601234, lng: -55.8974411, precision: 12.5 },
});

const SIN_NADA = arbolParaFicha({ especie: null, parcela: null, posicion: null, gps: null });

beforeAll(() => registrarFuentes(FUENTES_NODE));

const muchos = (cantidad: number, arbol = PEOR_CASO) =>
  Array.from({ length: cantidad }, (_, indice) => ({ ...arbol, id: `t${indice}` }));

/** El documento con fotos ya bajadas; `fotoDe` decide cuál falla. */
function renderizar(
  arboles: readonly ArbolParaFicha[],
  modo: ModoReporte = MODO_REPORTE.conFotos,
  fotoDe: (indice: number) => FotoPdf = () => LISTA,
) {
  const { tarjetas, listado } = repartirArboles(arboles, modo);
  const reparto = {
    tarjetas: tarjetas.map((arbol, indice) => datosTarjeta(arbol, fotoDe(indice), COLOR_DE)),
    listado: listado.map((arbol) => datosArbolReporte(arbol, COLOR_DE)),
  };
  return renderToBuffer(
    <DocumentoReporte encabezado={ENCABEZADO} emitido="12/10/2026" reparto={reparto} />,
  );
}

const ocurrencias = (textos: string[], buscado: string) =>
  textos.filter((texto) => texto === buscado).length;

test('la hoja es A4 horizontal: más ancha que alta', async () => {
  const pdf = await renderizar([PEOR_CASO]);
  const [, ancho, alto] = pdf.toString('latin1').match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/)!;
  expect([Math.round(Number(ancho)), Math.round(Number(alto))]).toEqual([842, 595]);
});

/** El cuerpo de una hoja del plan, solo: si no entrara, saldría en dos. */
async function hojasQueOcupa(cuerpo: ReactNode) {
  const pdf = await renderToBuffer(
    <Document>
      <Hoja
        orientacion={ORIENTACION_HOJA.horizontal}
        encabezado={ENCABEZADO}
        documento="Reporte"
        emitido="12/10/2026"
      >
        {cuerpo}
      </Hoja>
    </Document>,
  );
  return paginasDelPdf(pdf);
}

const tarjetas = (cantidad: number) =>
  muchos(cantidad).map((arbol) => datosTarjeta(arbol, LISTA, COLOR_DE));
const filas = (cantidad: number) =>
  muchos(cantidad).map((arbol) => datosArbolReporte(arbol, COLOR_DE));

test('6 tarjetas del peor caso entran justas en una hoja, sin partirse', async () => {
  expect(await hojasQueOcupa(<GrillaTarjetas tarjetas={tarjetas(TARJETAS_POR_HOJA)} />)).toBe(1);
  // Una fila más ya no entra: la prueba detecta el desborde.
  const deMas = tarjetas(TARJETAS_POR_HOJA + MEDIDA_REPORTE.columnasTarjetas);
  expect(await hojasQueOcupa(<GrillaTarjetas tarjetas={deMas} />)).toBe(2);
});

test('las filas del peor caso entran justas en una hoja, debajo del encabezado', async () => {
  expect(await hojasQueOcupa(<Listado filas={filas(FILAS_POR_HOJA)} />)).toBe(1);
  expect(await hojasQueOcupa(<Listado filas={filas(FILAS_POR_HOJA + 1)} />)).toBe(2);
});

test('6 tarjetas llenan una hoja y la séptima abre otra', async () => {
  expect(paginasDelPdf(await renderizar(muchos(TARJETAS_POR_HOJA)))).toBe(1);
  expect(paginasDelPdf(await renderizar(muchos(TARJETAS_POR_HOJA + 1)))).toBe(2);
});

test('en la tarjeta del peor caso se ven todos los datos y lo largo termina en «…»', async () => {
  const textos = textosDelPdf(await renderizar([PEOR_CASO]));
  expect(textos).toEqual(
    expect.arrayContaining([
      'LPN12L10ANCH123-SS2026B',
      'LPN12',
      'L10',
      '123',
      '14/09/2026',
      '-27.360123, -55.897441',
      'Loma de los Paraísos Norte, ladera…',
    ]),
  );
  const especie = textos.find((texto) => texto.startsWith('ANCHC · Anchico'));
  expect(especie).toMatch(/…$/);
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
  const pdf = await renderizar(muchos(FILAS_POR_HOJA * 3 + 1, { ...PEOR_CASO, fotoUrl: null }));
  expect(paginasDelPdf(pdf)).toBe(4);
  expect(ocurrencias(textosDelPdf(pdf), 'ID ÁRBOL')).toBe(4);
});

test('7 tarjetas y 40 filas: las hojas que estima el modal, y el pie con la cantidad', async () => {
  const arboles = [...muchos(7), ...muchos(40, { ...SIN_NADA, fotoUrl: null })];
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
});

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
  expect(ocurrencias(textos, 'LPN12L10ANCH123-SS2026B')).toBe(TARJETAS_POR_HOJA);
  expect(textos).toEqual(expect.arrayContaining(['123', '14/09/2026', '-27.360123, -55.897441']));
});

test('ni ID Global ni técnico (#822)', async () => {
  const textos = textosDelPdf(await renderizar([PEOR_CASO, { ...SIN_NADA, fotoUrl: null }]));
  expect(textos.join(' ')).not.toMatch(/ID Global|Técnico/i);
});
