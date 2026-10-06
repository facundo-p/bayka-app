// @vitest-environment node
// node y no jsdom: con jsdom, pdfkit no reconoce los Buffer de las imágenes (otro realm).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToBuffer } from '@react-pdf/renderer';
import { arbolParaFicha } from '../../../test/fabricas';
import { ESTADO_FOTO, type FotoPdf } from '../../estadoFoto';
import { registrarFuentes, type ArchivosFuentes } from '../../plantilla/fuentes';
import { encabezadoDePlantacion } from '../../plantilla/textos';
import { datosFicha } from '../datosFicha';
import { DocumentoFichas } from '../DocumentoFichas';

const WEB = `${resolve(__dirname, '../../../..')}/`;
const POPPINS = `${WEB}node_modules/@fontsource/poppins/files/poppins-latin`;
const FUENTES: ArchivosFuentes = {
  biolinum: `${WEB}public/fonts/LinBiolinum_R.otf`,
  biolinumBold: `${WEB}public/fonts/LinBiolinum_RB.otf`,
  poppins: `${POPPINS}-400-normal.woff`,
  poppinsItalica: `${POPPINS}-400-italic.woff`,
  poppinsMedio: `${POPPINS}-500-normal.woff`,
  poppinsSemibold: `${POPPINS}-600-normal.woff`,
  poppinsBold: `${POPPINS}-700-normal.woff`,
  plexMono: `${WEB}public/fonts/ibm-plex-mono-latin-400-normal.ttf`,
  plexMonoMedio: `${WEB}public/fonts/ibm-plex-mono-latin-500-normal.ttf`,
};
const LOGO = `${WEB}public/logo-bayka.png`;
const PNG = `data:image/png;base64,${readFileSync(LOGO).toString('base64')}`;

const ENCABEZADO = encabezadoDePlantacion(
  { lugar: 'San Sebastián', periodo: '2025-2026', codigo: 'SS26' },
  'Bayka',
  LOGO,
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

const LISTA: FotoPdf = { estado: ESTADO_FOTO.lista, src: PNG };

function paginas(pdf: Buffer): number {
  return pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;
}

beforeAll(() => registrarFuentes(FUENTES));

test('una ficha completa entra en una hoja', async () => {
  const fichas = [datosFicha(CON_TODO, { tecnico: 'Lucía', foto: LISTA, mapa: PNG })];
  const pdf = await renderToBuffer(
    <DocumentoFichas encabezado={ENCABEZADO} emitido="06/10/2026" fichas={fichas} />,
  );
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(paginas(pdf)).toBe(1);
});

test('con los casos borde, tres fichas por hoja', async () => {
  const sinNada = arbolParaFicha();
  const fichas = [
    datosFicha(CON_TODO, { tecnico: null, foto: LISTA, mapa: PNG }),
    datosFicha(sinNada, { tecnico: null, foto: { estado: ESTADO_FOTO.sinFoto }, mapa: null }),
    datosFicha(sinNada, { tecnico: null, foto: { estado: ESTADO_FOTO.noDisponible }, mapa: null }),
    datosFicha(CON_TODO, { tecnico: null, foto: LISTA, mapa: PNG }),
  ];
  const pdf = await renderToBuffer(
    <DocumentoFichas encabezado={ENCABEZADO} emitido="06/10/2026" fichas={fichas} />,
  );
  expect(paginas(pdf)).toBe(2);
});
