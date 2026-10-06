// @vitest-environment node
// node y no jsdom: con jsdom, pdfkit no reconoce los Buffer de las imágenes (otro realm).
import { renderToBuffer } from '@react-pdf/renderer';
import { entradaInforme } from '../../../test/informePdf';
import { FUENTES_NODE, LOGO_NODE, paginasDelPdf, PNG_DE_PRUEBA } from '../../../test/pdfNode';
import { textosDelPdf } from '../../../test/textoPdf';
import { ESTADO_MAPA } from '../../mapa/estadoMapa';
import { registrarFuentes } from '../../plantilla/fuentes';
import { encabezadoDePlantacion } from '../../plantilla/textos';
import { datosInforme, type EntradaInforme } from '../datosInforme';
import { DocumentoInforme } from '../DocumentoInforme';
import { cajaDelMapa } from '../mapaInforme';
import { planificarInforme } from '../planificarInforme';

/** Como el motor del navegador, pero con un PNG cualquiera en lugar del canvas. */
async function renderizar(entrada: EntradaInforme) {
  registrarFuentes(FUENTES_NODE);
  const modelo = datosInforme(entrada);
  const plan = planificarInforme(modelo);
  const mapa = modelo.mapa.vacio
    ? null
    : {
        mapa: { estado: ESTADO_MAPA.listo, src: PNG_DE_PRUEBA },
        caja: cajaDelMapa(modelo.mapa.puntos, plan.disponible),
      };
  const encabezado = encabezadoDePlantacion(entrada.plantacion, entrada.organizacion, LOGO_NODE);
  const pdf = await renderToBuffer(
    <DocumentoInforme {...{ encabezado, emitido: '06/10/2026', modelo, plan, mapa }} />,
  );
  return { pdf, textos: textosDelPdf(pdf) };
}

test('4 parcelas y 4 especies: todo en una hoja, con el mapa al pie', async () => {
  const { pdf, textos } = await renderizar(entradaInforme({ parcelas: 4, especies: 4, nn: 3 }));
  expect(paginasDelPdf(pdf)).toBe(1);
  expect(textos).toEqual(
    expect.arrayContaining([
      'Informe de plantación',
      'Distribución por especie · 4 especies',
      'N/N · Sin identificar',
      'Árboles por parcela',
      'Total · 4 parcelas',
      'Puntos GPS por especie',
      'Emitido el 06/10/2026 · Página 1 de 1',
    ]),
  );
});

test('17 parcelas y 9 especies: resumen y tabla en la hoja 1, el mapa en la 2', async () => {
  const { pdf, textos } = await renderizar(entradaInforme({ parcelas: 17, especies: 9, nn: 3 }));
  expect(paginasDelPdf(pdf)).toBe(2);
  expect(textos).toEqual(
    expect.arrayContaining([
      'Total · 17 parcelas',
      'Puntos GPS por especie',
      'Emitido el 06/10/2026 · Página 2 de 2',
    ]),
  );
});

test('sin árboles ni GPS el informe sale igual y explica los vacíos', async () => {
  const { pdf, textos } = await renderizar(
    entradaInforme({ parcelas: 2, especies: 0, objetivo: null }),
  );
  expect(paginasDelPdf(pdf)).toBe(1);
  expect(textos).toContain('Todavía no hay árboles registrados.');
});

test('un PDF anterior no rompe los caracteres del siguiente', async () => {
  // El primero usa «·» en negrita sin «.»: fontkit guarda el punto sin su carácter.
  await renderizar(entradaInforme({ parcelas: 2, especies: 2 }));
  const conMiles = entradaInforme({ parcelas: 2, especies: 2 });
  conMiles.dashboard.porParcela[0].cantidad = 8221;
  const { textos } = await renderizar(conMiles);
  // La fila de total, en negrita: 8.221 + 15.
  expect(textos).toContain('8.236');
});
