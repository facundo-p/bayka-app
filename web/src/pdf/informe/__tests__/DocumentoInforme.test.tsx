// @vitest-environment node
// node y no jsdom: con jsdom, pdfkit no reconoce los Buffer de las imágenes (otro realm).
import { renderToBuffer } from '@react-pdf/renderer';
import { entradaInforme } from '../../../test/informePdf';
import { FUENTES_NODE, LOGO_NODE, paginasDelPdf, PNG_DE_PRUEBA } from '../../../test/pdfNode';
import { textosDelPdf } from '../../../test/textoPdf';
import { ESTADO_MAPA } from '../../mapa/estadoMapa';
import { registrarFuentes, renderizarEnSerie } from '../../plantilla/fuentes';
import { encabezadoDePlantacion } from '../../plantilla/textos';
import { CAJA_MAPA_INFORME } from '../../plantilla/tokens';
import { datosInforme, type EntradaInforme } from '../datosInforme';
import { DocumentoInforme } from '../DocumentoInforme';
import { esMapaEnHojaCompleta, planificarInforme } from '../planificarInforme';

// El extractor lee la nota al pie en dos tramos: «* » y la atribución.
const ATRIBUCION = 'Imágenes © Esri, Maxar';

/** Como el motor del navegador, pero con un PNG cualquiera en lugar del canvas. */
async function renderizar(entrada: EntradaInforme, sinMapa = false, conSatelite = false) {
  registrarFuentes(FUENTES_NODE);
  const calculado = datosInforme(entrada);
  // Sin mapa: el aviso de una línea en su lugar, para contar las hojas del resto.
  const modelo = sinMapa ? { ...calculado, mapa: { ...calculado.mapa, vacio: 'x' } } : calculado;
  const plan = planificarInforme(modelo);
  const mapa = modelo.mapa.vacio
    ? null
    : {
        mapa: { estado: ESTADO_MAPA.listo, src: PNG_DE_PRUEBA, conSatelite },
        caja: CAJA_MAPA_INFORME,
      };
  const encabezado = encabezadoDePlantacion(entrada.plantacion, entrada.organizacion, LOGO_NODE);
  const pdf = await renderToBuffer(
    <DocumentoInforme {...{ encabezado, emitido: '06/10/2026', modelo, plan, mapa }} />,
  );
  return { pdf, textos: textosDelPdf(pdf), plan };
}

test('1 parcela y 1 especie: todo en una hoja, con el mapa al pie', async () => {
  const { pdf, textos } = await renderizar(entradaInforme({ parcelas: 1, especies: 1, nn: 3 }));
  expect(paginasDelPdf(pdf)).toBe(1);
  expect(textos).toEqual(
    expect.arrayContaining([
      'Informe de plantación',
      'N/N · Sin identificar',
      'Árboles por parcela',
      'Puntos GPS por especie',
      'Emitido el 06/10/2026 · Página 1 de 1',
    ]),
  );
});

test('4 parcelas y 4 especies: el mapa 16:9 no entra al pie y abre la hoja 2', async () => {
  const { pdf, textos } = await renderizar(entradaInforme({ parcelas: 4, especies: 4, nn: 3 }));
  expect(paginasDelPdf(pdf)).toBe(2);
  expect(hojaDeTexto(textos, 'Total · 4 parcelas')).toBe(1);
  expect(hojaDeTexto(textos, 'Puntos GPS por especie')).toBe(2);
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

test('las especies empiezan en la hoja 1 aunque el bloque entero entre en la siguiente', async () => {
  // Con 38 especies el bloque entraba justo en la hoja 1 salvo su margen inferior,
  // y react-pdf lo mandaba entero a la hoja 2: la 1 quedaba con el resumen solo.
  for (let especies = 30; especies <= 44; especies += 1) {
    const { textos } = await renderizar(entradaInforme({ parcelas: 17, especies }), true);
    const titulo = textos.indexOf(`Distribución por especie · ${especies} especies`);
    const pieHoja1 = textos.findIndex((texto) => texto.includes('Página 1 de'));
    expect(titulo, `${especies} especies`).toBeLessThan(pieHoja1);
  }
}, 30_000);

/** Hoja, desde 1, del tramo en esa posición: cada hoja cierra con su pie de página. */
function hojaDe(textos: string[], posicion: number) {
  if (posicion < 0) throw new Error('El texto no está en el PDF');
  return textos.slice(0, posicion).filter((texto) => texto.includes('Página ')).length + 1;
}

const hojaDeTexto = (textos: string[], texto: string) => hojaDe(textos, textos.indexOf(texto));

function posiciones(textos: string[], patron: RegExp) {
  return textos.flatMap((texto, posicion) => (patron.test(texto) ? [posicion] : []));
}

// Más allá de la hoja 2: el listado cruza al menos dos saltos de hoja.
const HOJA_MINIMA_DEL_FINAL = 3;

test('100 especies: el listado sigue en las hojas siguientes, sin perder filas', async () => {
  const { pdf, textos } = await renderizar(entradaInforme({ parcelas: 17, especies: 100 }));
  // Las filas del fixture: «E30 · Especie E30».
  const filas = posiciones(textos, /^\S+ · Especie \S+$/);
  expect(filas).toHaveLength(100);
  expect(hojaDeTexto(textos, 'Distribución por especie · 100 especies')).toBe(1);
  expect(hojaDe(textos, filas[0])).toBe(1);
  expect(hojaDe(textos, filas[filas.length - 1])).toBeGreaterThanOrEqual(HOJA_MINIMA_DEL_FINAL);
  expect(hojaDeTexto(textos, 'Puntos GPS por especie')).toBe(paginasDelPdf(pdf));
}, 30_000);

test('120 parcelas: la tabla sigue en las hojas siguientes con su encabezado', async () => {
  const { pdf, textos } = await renderizar(entradaInforme({ parcelas: 120, especies: 14 }));
  // Las filas del fixture: «Parcela 7», con el código aparte.
  const filas = posiciones(textos, /^Parcela \d+$/);
  expect(filas).toHaveLength(120);
  const primera = hojaDeTexto(textos, 'Árboles por parcela');
  const ultima = hojaDe(textos, filas[filas.length - 1]);
  expect(primera).toBe(1);
  expect(ultima).toBeGreaterThanOrEqual(HOJA_MINIMA_DEL_FINAL);
  // Una vez por hoja que ocupa la tabla; el estilo lo pasa a mayúsculas.
  expect(textos.filter((texto) => texto === 'GRUPOS')).toHaveLength(ultima - primera + 1);
  expect(hojaDeTexto(textos, 'Total · 120 parcelas')).toBe(ultima);
  expect(hojaDeTexto(textos, 'Puntos GPS por especie')).toBe(paginasDelPdf(pdf));
}, 30_000);

test('con satélite, el mapa lleva la llamada y la última hoja la nota de Esri al pie', async () => {
  const entrada = entradaInforme({ parcelas: 1, especies: 1, nn: 3 });
  const conSatelite = await renderizar(entrada, false, true);
  expect(conSatelite.textos).toEqual(expect.arrayContaining(['*', ATRIBUCION]));
  expect(paginasDelPdf(conSatelite.pdf)).toBe(1);
  const liso = (await renderizar(entrada)).textos;
  expect(liso).not.toContain(ATRIBUCION);
  expect(liso).not.toContain('*');
});

test('la nota de Esri va solo al pie de la hoja del mapa', async () => {
  const { pdf, textos } = await renderizar(
    entradaInforme({ parcelas: 17, especies: 9, nn: 3 }),
    false,
    true,
  );
  expect(paginasDelPdf(pdf)).toBe(2);
  const nota = textos.indexOf(ATRIBUCION);
  expect(nota).toBeGreaterThan(textos.findIndex((texto) => texto.includes('Página 1 de 2')));
  expect(textos.lastIndexOf(ATRIBUCION)).toBe(nota);
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
  conMiles.dashboard.totalArboles = 8236;
  const { textos } = await renderizar(conMiles);
  // La fila de total, en negrita.
  expect(textos).toContain('8.236');
});

test('cuando el plan pone el mapa al pie, entra en la última hoja', async () => {
  for (let parcelas = 1; parcelas <= 30; parcelas += 2) {
    const entrada = entradaInforme({ parcelas, especies: 9, nn: 3 });
    const { pdf, plan } = await renderizar(entrada);
    if (esMapaEnHojaCompleta(plan)) continue;
    const { pdf: sinMapa } = await renderizar(entrada, true);
    expect(paginasDelPdf(pdf), `${parcelas} parcelas`).toBe(paginasDelPdf(sinMapa));
  }
}, 30_000);

test('dos documentos pedidos a la vez salen enteros, uno después del otro', async () => {
  const documento = (parcelas: number) => {
    const entrada = entradaInforme({ parcelas, especies: 2 });
    const modelo = datosInforme(entrada);
    const encabezado = encabezadoDePlantacion(entrada.plantacion, null, LOGO_NODE);
    const plan = planificarInforme(modelo);
    const props = { encabezado, emitido: '06/10/2026', modelo, plan, mapa: null };
    return renderizarEnSerie(FUENTES_NODE, () => renderToBuffer(<DocumentoInforme {...props} />));
  };
  const [primero, segundo] = await Promise.all([documento(2), documento(3)]);
  expect(textosDelPdf(primero)).toContain('Total · 2 parcelas');
  expect(textosDelPdf(segundo)).toContain('Total · 3 parcelas');
});
