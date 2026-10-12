// @vitest-environment node
// node y no jsdom: con jsdom, pdfkit no reconoce los Buffer de las imágenes (otro realm).
import { Document, renderToBuffer, Text } from '@react-pdf/renderer';
import { FUENTES_NODE, LOGO_NODE } from '../../../test/pdfNode';
import { registrarFuentes } from '../fuentes';
import { Hoja } from '../Hoja';
import { encabezadoDePlantacion } from '../textos';
import { ORIENTACION_HOJA, type OrientacionHoja } from '../tokens';

beforeAll(() => registrarFuentes(FUENTES_NODE));

const ENCABEZADO = encabezadoDePlantacion(
  { lugar: 'San Sebastián', periodo: '2025-2026', codigo: 'SS26' },
  'Bayka',
  LOGO_NODE,
);

/** Ancho y alto de la hoja en pt, redondeados: el A4 de react-pdf tiene decimales. */
async function medidaDeHoja(orientacion?: OrientacionHoja) {
  const pdf = await renderToBuffer(
    <Document>
      <Hoja
        encabezado={ENCABEZADO}
        documento="Ficha"
        emitido="12/10/2026"
        orientacion={orientacion}
      >
        <Text>Cuerpo</Text>
      </Hoja>
    </Document>,
  );
  const [, ancho, alto] = pdf.toString('latin1').match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/)!;
  return [Math.round(Number(ancho)), Math.round(Number(alto))];
}

test('sin orientación la hoja queda A4 parada, como la ficha y el informe', async () => {
  expect(await medidaDeHoja()).toEqual([595, 842]);
});

test('horizontal, el mismo A4 acostado', async () => {
  expect(await medidaDeHoja(ORIENTACION_HOJA.horizontal)).toEqual([842, 595]);
});
