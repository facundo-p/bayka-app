// @vitest-environment node
// node y no jsdom: con jsdom, pdfkit no reconoce los Buffer de las imágenes (otro realm).
import { renderToBuffer } from '@react-pdf/renderer';
import { arbolParaFicha } from '../../../test/fabricas';
import { FUENTES_NODE, LOGO_NODE, paginasDelPdf, PNG_DE_PRUEBA } from '../../../test/pdfNode';
import { textosDelPdf } from '../../../test/textoPdf';
import { ESTADO_FOTO, type FotoPdf } from '../../estadoFoto';
import { ESTADO_MAPA, MAPA_NO_DISPONIBLE, MAPA_SIN_GPS, type MapaPdf } from '../../mapa/estadoMapa';
import { registrarFuentes, renderizarEnSerie } from '../../plantilla/fuentes';
import { encabezadoDePlantacion } from '../../plantilla/textos';
import { datosFicha } from '../datosFicha';
import { DocumentoFichas } from '../DocumentoFichas';

const ENCABEZADO = encabezadoDePlantacion(
  { lugar: 'San Sebastián', periodo: '2025-2026', codigo: 'SS26' },
  'Bayka',
  LOGO_NODE,
);

const CON_TODO = arbolParaFicha({
  idGlobal: 10479,
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
const MAPA: MapaPdf = { estado: ESTADO_MAPA.listo, src: PNG_DE_PRUEBA };

beforeAll(() => registrarFuentes(FUENTES_NODE));

test('una ficha completa entra en una hoja', async () => {
  const fichas = [datosFicha(CON_TODO, { tecnico: 'Lucía', foto: LISTA, mapa: MAPA })];
  const pdf = await renderToBuffer(
    <DocumentoFichas encabezado={ENCABEZADO} emitido="06/10/2026" fichas={fichas} />,
  );
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(paginasDelPdf(pdf)).toBe(1);
});

test('con los casos borde, tres fichas por hoja', async () => {
  const sinNada = arbolParaFicha();
  const fichas = [
    datosFicha(CON_TODO, { tecnico: null, foto: LISTA, mapa: MAPA }),
    datosFicha(sinNada, {
      tecnico: null,
      foto: { estado: ESTADO_FOTO.sinFoto },
      mapa: MAPA_SIN_GPS,
    }),
    datosFicha(sinNada, {
      tecnico: null,
      foto: { estado: ESTADO_FOTO.noDisponible },
      mapa: MAPA_NO_DISPONIBLE,
    }),
    datosFicha(CON_TODO, { tecnico: null, foto: LISTA, mapa: MAPA_NO_DISPONIBLE }),
  ];
  const pdf = await renderToBuffer(
    <DocumentoFichas encabezado={ENCABEZADO} emitido="06/10/2026" fichas={fichas} />,
  );
  expect(paginasDelPdf(pdf)).toBe(2);
  expect(textosDelPdf(pdf)).toEqual(
    expect.arrayContaining([
      'Emitido el 06/10/2026 · Página 1 de 2',
      'Emitido el 06/10/2026 · Página 2 de 2',
      'Sin punto GPS',
      'Mapa no disponible',
    ]),
  );
});

// Todo lo que puede partirse en dos líneas, partido: si esto entra, cualquier hoja de tres entra.
const PEOR_CASO = arbolParaFicha({
  subId: 'LPN12L10ANCH123',
  idArbol: 'LPN12L10ANCH123-SS2026B',
  idGlobal: 1048576,
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

test('tres fichas en el peor caso realista entran en una hoja', async () => {
  const contexto = { tecnico: 'María Fernanda Etchegoyen Larrañaga', foto: LISTA, mapa: MAPA };
  const fichas = [1, 2, 3].map(() => datosFicha(PEOR_CASO, contexto));
  const pdf = await renderToBuffer(
    <DocumentoFichas encabezado={ENCABEZADO} emitido="06/10/2026" fichas={fichas} />,
  );
  expect(paginasDelPdf(pdf)).toBe(1);
});

test('una ficha anterior no rompe los caracteres de la siguiente', async () => {
  const renderizar = (arbol: typeof CON_TODO) =>
    renderizarEnSerie(FUENTES_NODE, () =>
      renderToBuffer(
        <DocumentoFichas
          encabezado={ENCABEZADO}
          emitido="06/10/2026"
          fichas={[datosFicha(arbol, { tecnico: 'Lucía', foto: LISTA, mapa: MAPA })]}
        />,
      ),
    );
  // La primera usa «·» en semibold sin «.»: fontkit guarda el punto sin su carácter.
  await renderizar(CON_TODO);
  const conPunto = { ...CON_TODO, especie: { ...CON_TODO.especie!, nombre: 'Anchico s.l.' } };
  expect(textosDelPdf(await renderizar(conPunto))).toContain('ANC · Anchico s.l.');
});
