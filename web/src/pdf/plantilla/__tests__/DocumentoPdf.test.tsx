// @vitest-environment node
import { Page, renderToBuffer, Text } from '@react-pdf/renderer';
import { DocumentoPdf } from '../DocumentoPdf';
import { encabezadoDePlantacion } from '../textos';

const ENCABEZADO = encabezadoDePlantacion(
  { lugar: 'San Sebastián', periodo: '2025-2026' },
  '/logo.png',
);

/** Así guarda pdfkit un texto no ASCII de los metadatos: UTF-16 con BOM. */
const enUtf16 = (texto: string) =>
  Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(texto, 'utf16le').swap16()]);

test('el visor titula el archivo «Documento · Lugar · Período», creado por Bayka', async () => {
  const pdf = await renderToBuffer(
    <DocumentoPdf documento="Informe de plantación" encabezado={ENCABEZADO}>
      <Page>
        <Text>Cuerpo</Text>
      </Page>
    </DocumentoPdf>,
  );
  expect(pdf.includes(enUtf16('Informe de plantación · San Sebastián · 2025-2026'))).toBe(true);
  expect(pdf.toString('latin1').match(/\/(Creator|Producer) \d+ 0 R/g)).toHaveLength(2);
  expect(pdf.toString('latin1').match(/\(Bayka\)/g)).toHaveLength(2);
});
