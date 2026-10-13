// @vitest-environment node
// node y no jsdom: con jsdom, pdfkit no reconoce los Buffer de las imágenes (otro realm).
import { renderToBuffer } from '@react-pdf/renderer';
import { arbolParaFicha, coloresEnOrden } from '../../../test/fabricas';
import { FUENTES_NODE, LOGO_NODE, paginasDelPdf, PNG_DE_PRUEBA } from '../../../test/pdfNode';
import { textosDelPdf } from '../../../test/textoPdf';
import { ESTADO_FOTO, type FotoPdf } from '../../estadoFoto';
import { ESTADO_MAPA, MAPA_NO_DISPONIBLE, type MapaPdf } from '../../mapa/estadoMapa';
import { registrarFuentes, renderizarEnSerie } from '../../plantilla/fuentes';
import { encabezadoDePlantacion } from '../../plantilla/textos';
import { datosFicha, type ModeloFicha } from '../datosFicha';
import { DocumentoFicha } from '../DocumentoFicha';

const COLOR_DE = coloresEnOrden('ANC');

const ENCABEZADO = encabezadoDePlantacion(
  { lugar: 'San Sebastián', periodo: '2025-2026', codigo: 'SS26' },
  'Bayka',
  LOGO_NODE,
);

const CON_TODO = arbolParaFicha({
  especie: {
    codigo: 'ANC',
    nombre: 'Anchico',
    nombreCientifico: 'Parapiptadenia rigida',
    tipo: 'flora',
    subtipo: 'arbol',
  },
  gps: { lat: -27.36, lng: -55.89, precision: 4 },
});

const LISTA: FotoPdf = { estado: ESTADO_FOTO.lista, src: PNG_DE_PRUEBA };
const MAPA: MapaPdf = { estado: ESTADO_MAPA.listo, src: PNG_DE_PRUEBA, conSatelite: false };
const MAPA_SATELITE: MapaPdf = { ...MAPA, conSatelite: true };
// El extractor lee la nota en dos tramos: «* » y la atribución.
const ATRIBUCION = 'Imágenes © Esri, Maxar';

// Todo lo que puede partirse en varios renglones, partido: si esto entra, cualquier ficha entra.
const PEOR_CASO = arbolParaFicha({
  subId: 'LPN12L10ANCH123',
  idArbol: 'LPN12L10ANCH123-SS2026B',
  posicion: 123,
  especie: {
    codigo: 'ANCHC',
    nombre: 'Anchico colorado de los montes misioneros del Alto Paraná',
    nombreCientifico:
      'Parapiptadenia rigida (Benth.) Brenan var. grandiflora subsp. misionensis Burkart',
    tipo: 'flora',
    subtipo: 'arbol',
  },
  parcela: { codigo: 'LPN12', nombre: 'Loma de los Paraísos Norte, ladera del arroyo Itaembé' },
  grupo: { codigo: 'L10', nombre: 'Línea 10 del sector bajo del bañado' },
  gps: { lat: -27.3601234, lng: -55.8974411, precision: 12.5 },
});

const TECNICO_LARGO = 'María Fernanda Etchegoyen Larrañaga';

function renderizar(modelo: ModeloFicha) {
  return renderToBuffer(
    <DocumentoFicha encabezado={ENCABEZADO} emitido="06/10/2026" ficha={modelo} />,
  );
}

function ficha(
  arbol: typeof CON_TODO,
  foto: FotoPdf,
  mapa: MapaPdf,
  tecnico: string | null = null,
) {
  return datosFicha(arbol, { colorDe: COLOR_DE, tecnico, foto, mapa });
}

beforeAll(() => registrarFuentes(FUENTES_NODE));

test('una ficha completa entra en una hoja, con el documento al pie', async () => {
  const pdf = await renderizar(ficha(CON_TODO, LISTA, MAPA_SATELITE, 'Lucía'));
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(paginasDelPdf(pdf)).toBe(1);
  expect(textosDelPdf(pdf)).toContain('Ficha de árbol');
});

test.each([
  {
    caso: 'sin foto',
    modelo: ficha(CON_TODO, { estado: ESTADO_FOTO.sinFoto }, MAPA_SATELITE),
    avisos: ['Sin foto'],
  },
  {
    caso: 'foto y mapa no disponibles',
    modelo: ficha(CON_TODO, { estado: ESTADO_FOTO.noDisponible }, MAPA_NO_DISPONIBLE),
    avisos: ['Foto no disponible', 'Mapa no disponible'],
  },
  {
    caso: 'sin GPS',
    modelo: ficha({ ...CON_TODO, gps: null }, LISTA, MAPA),
    avisos: ['Sin punto GPS', 'Sin punto'],
  },
  {
    caso: 'sin especie',
    modelo: ficha({ ...CON_TODO, especie: null }, LISTA, MAPA),
    avisos: ['N/N · Sin identificar'],
  },
])('$caso: entra en una hoja y lo avisa', async ({ modelo, avisos }) => {
  const pdf = await renderizar(modelo);
  expect(paginasDelPdf(pdf)).toBe(1);
  expect(textosDelPdf(pdf)).toEqual(
    expect.arrayContaining(['Emitido el 06/10/2026 · Página 1 de 1', ...avisos]),
  );
});

test('el peor caso realista, con la llamada del satélite, entra en una hoja', async () => {
  const pdf = await renderizar(ficha(PEOR_CASO, LISTA, MAPA_SATELITE, TECNICO_LARGO));
  expect(paginasDelPdf(pdf)).toBe(1);
  // Entero en un tramo: el ID largo no se parte ni se mete debajo de la foto.
  expect(textosDelPdf(pdf)).toContain(PEOR_CASO.idArbol);
});

test('con satélite, el minimapa lleva la llamada y la hoja la nota de Esri al pie', async () => {
  const textosCon = async (mapa: MapaPdf) =>
    textosDelPdf(await renderizar(ficha(CON_TODO, LISTA, mapa)));
  expect(await textosCon(MAPA_SATELITE)).toEqual(expect.arrayContaining(['*', ATRIBUCION]));
  const liso = await textosCon(MAPA);
  expect(liso).not.toContain(ATRIBUCION);
  expect(liso).not.toContain('*');
});

test('sin GPS no hay minimapa ni nota de Esri, aunque el mapa sea satelital', async () => {
  const sinGps = ficha({ ...CON_TODO, gps: null }, LISTA, MAPA_SATELITE);
  const textos = textosDelPdf(await renderizar(sinGps));
  expect(textos).not.toContain(ATRIBUCION);
  expect(textos).not.toContain('*');
});

test('la ficha lleva el ID Árbol y no un ID Global (#822)', async () => {
  const textos = textosDelPdf(await renderizar(ficha(CON_TODO, LISTA, MAPA)));
  expect(textos).toEqual(expect.arrayContaining(['ID ÁRBOL', CON_TODO.idArbol]));
  expect(textos.join(' ')).not.toMatch(/ID Global/i);
});

test('una ficha anterior no rompe los caracteres de la siguiente', async () => {
  const renderizarSola = (arbol: typeof CON_TODO) =>
    renderizarEnSerie(FUENTES_NODE, () => renderizar(ficha(arbol, LISTA, MAPA, 'Lucía')));
  // La primera usa «·» en semibold sin «.»: fontkit guarda el punto sin su carácter.
  await renderizarSola(CON_TODO);
  const conPunto = { ...CON_TODO, especie: { ...CON_TODO.especie!, nombre: 'Anchico s.l.' } };
  expect(textosDelPdf(await renderizarSola(conPunto))).toContain('ANC · Anchico s.l.');
});
