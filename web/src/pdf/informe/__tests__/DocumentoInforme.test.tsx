// @vitest-environment node
// node y no jsdom: con jsdom, pdfkit no reconoce los Buffer de las imágenes (otro realm).
import { renderToBuffer } from '@react-pdf/renderer';
import { opcionesCon, type OpcionesInforme } from '../../../lib/opcionesInforme';
import {
  combinacionesDeOpciones,
  entradaInforme,
  nombreCombinacion,
} from '../../../test/informePdf';
import { FUENTES_NODE, LOGO_NODE, paginasDelPdf, PNG_DE_PRUEBA } from '../../../test/pdfNode';
import { textosDelPdf } from '../../../test/textoPdf';
import { ESTADO_MAPA } from '../../mapa/estadoMapa';
import { registrarFuentes, renderizarEnSerie } from '../../plantilla/fuentes';
import { encabezadoDePlantacion } from '../../plantilla/textos';
import { datosInforme, tieneMapa, type EntradaInforme, type ModeloInforme } from '../datosInforme';
import { DocumentoInforme, type MapaDelDocumento } from '../DocumentoInforme';
import {
  esMapaEnHojaCompleta,
  planificarInforme,
  UBICACION_MAPA,
  type UbicacionMapa,
} from '../planificarInforme';

// El extractor lee la nota al pie en dos tramos: «* » y la atribución.
const ATRIBUCION = 'Imágenes © Esri, Maxar';
const TITULO_MAPA = 'Puntos GPS por especie';

type Variante = { conSatelite?: boolean; ubicacion?: UbicacionMapa };

/** Como el motor del navegador, pero con un PNG cualquiera en lugar del canvas. */
function mapaDe(modelo: ModeloInforme, variante: Variante): MapaDelDocumento | null {
  if (!tieneMapa(modelo)) return null;
  const plan = variante.ubicacion ? { ubicacion: variante.ubicacion } : planificarInforme(modelo);
  const conSatelite = variante.conSatelite ?? false;
  const imagen = modelo.mapa.vacio
    ? null
    : { mapa: { estado: ESTADO_MAPA.listo, src: PNG_DE_PRUEBA, conSatelite } };
  return { contenido: modelo.mapa, plan, imagen };
}

async function renderizar(entrada: EntradaInforme, variante: Variante = {}) {
  registrarFuentes(FUENTES_NODE);
  const modelo = datosInforme(entrada);
  const mapa = mapaDe(modelo, variante);
  const encabezado = encabezadoDePlantacion(entrada.plantacion, entrada.organizacion, LOGO_NODE);
  const pdf = await renderToBuffer(
    <DocumentoInforme {...{ encabezado, emitido: '06/10/2026', modelo, mapa }} />,
  );
  return { pdf, textos: textosDelPdf(pdf), plan: mapa?.plan ?? null };
}

/** La misma entrada sin el mapa: para contar las hojas del resto. */
const sinMapa = (entrada: EntradaInforme): EntradaInforme => ({
  ...entrada,
  opciones: { ...entrada.opciones, mapa: false },
});

/** Hoja, desde 1, del tramo en esa posición: cada hoja cierra con su pie de página. */
function hojaDe(textos: string[], posicion: number) {
  if (posicion < 0) throw new Error('El texto no está en el PDF');
  return textos.slice(0, posicion).filter((texto) => texto.includes('Página ')).length + 1;
}

const hojaDeTexto = (textos: string[], texto: string) => hojaDe(textos, textos.indexOf(texto));

function posiciones(textos: string[], patron: RegExp) {
  return textos.flatMap((texto, posicion) => (patron.test(texto) ? [posicion] : []));
}

// Lo que no es encabezado ni pie: el rótulo de árboles, los títulos de bloque y las filas.
const CONTENIDO = /^(ÁRBOLES REGISTRADOS|Distribución por especie|Puntos GPS por especie|\S+ · )/;

/** Las hojas con algo del cuerpo: si falta alguna, quedó una en blanco. */
function hojasConContenido(textos: string[]) {
  return [...new Set(posiciones(textos, CONTENIDO).map((posicion) => hojaDe(textos, posicion)))];
}

const hojasDel = (pdf: Buffer) => Array.from({ length: paginasDelPdf(pdf) }, (_, i) => i + 1);

test('1 especie: todo en una hoja, con el mapa al pie', async () => {
  const { pdf, textos } = await renderizar(entradaInforme({ parcelas: 1, especies: 1, nn: 3 }));
  expect(paginasDelPdf(pdf)).toBe(1);
  expect(textos).toEqual(
    expect.arrayContaining([
      'Informe de plantación',
      'N/N · Sin identificar',
      TITULO_MAPA,
      'Emitido el 06/10/2026 · Página 1 de 1',
    ]),
  );
});

test('11 especies y N/N: el mapa 16:9 no entra al pie y abre la hoja 2', async () => {
  const { pdf, textos } = await renderizar(entradaInforme({ parcelas: 4, especies: 11, nn: 3 }));
  expect(paginasDelPdf(pdf)).toBe(2);
  expect(hojaDeTexto(textos, 'N/N · Sin identificar')).toBe(1);
  expect(hojaDeTexto(textos, TITULO_MAPA)).toBe(2);
  expect(hojasConContenido(textos)).toEqual([1, 2]);
});

test('las especies empiezan en la hoja 1 aunque el bloque entero entre en la siguiente', async () => {
  // Con 38 especies el bloque entraba justo en la hoja 1 salvo su margen inferior,
  // y react-pdf lo mandaba entero a la hoja 2: la 1 quedaba con el resumen solo.
  for (let especies = 30; especies <= 44; especies += 1) {
    const { textos } = await renderizar(sinMapa(entradaInforme({ parcelas: 17, especies })));
    const titulo = textos.indexOf(`Distribución por especie · ${especies} especies`);
    const pieHoja1 = textos.findIndex((texto) => texto.includes('Página 1 de'));
    expect(titulo, `${especies} especies`).toBeLessThan(pieHoja1);
  }
}, 30_000);

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
  expect(hojaDeTexto(textos, TITULO_MAPA)).toBe(paginasDelPdf(pdf));
}, 30_000);

test('con satélite, el mapa lleva la llamada y la última hoja la nota de Esri al pie', async () => {
  const entrada = entradaInforme({ parcelas: 1, especies: 1, nn: 3 });
  const conSatelite = await renderizar(entrada, { conSatelite: true });
  expect(conSatelite.textos).toEqual(expect.arrayContaining(['*', ATRIBUCION]));
  expect(paginasDelPdf(conSatelite.pdf)).toBe(1);
  const liso = (await renderizar(entrada)).textos;
  expect(liso).not.toContain(ATRIBUCION);
  expect(liso).not.toContain('*');
});

test('la nota de Esri va solo al pie de la hoja del mapa', async () => {
  const { pdf, textos } = await renderizar(entradaInforme({ parcelas: 4, especies: 11, nn: 3 }), {
    conSatelite: true,
  });
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
  conMiles.dashboard.totalArboles = 8236;
  const { textos } = await renderizar(conMiles);
  // El total de árboles, en negrita.
  expect(textos).toContain('8.236');
});

test('cuando el plan pone el mapa al pie, entra en la última hoja', async () => {
  for (let especies = 1; especies <= 12; especies += 1) {
    const entrada = entradaInforme({ parcelas: 4, especies, nn: 3 });
    const { pdf, plan } = await renderizar(entrada);
    if (!plan || esMapaEnHojaCompleta(plan)) continue;
    const { pdf: soloElResto } = await renderizar(sinMapa(entrada));
    expect(paginasDelPdf(pdf), `${especies} especies`).toBe(paginasDelPdf(soloElResto));
  }
}, 30_000);

/** Con el mapa forzado al pie, ¿el informe ocupa las mismas hojas que sin mapa? */
async function entraAlPie(entrada: EntradaInforme) {
  const alPie = await renderizar(entrada, { ubicacion: UBICACION_MAPA.ultimaHoja });
  const soloElResto = await renderizar(sinMapa(entrada));
  return paginasDelPdf(alPie.pdf) === paginasDelPdf(soloElResto.pdf);
}

describe('en el borde de los informes cortos, con N/N', () => {
  test('con 10 especies el plan lo pone al pie y de verdad entra', async () => {
    const entrada = entradaInforme({ parcelas: 4, especies: 10, nn: 3 });
    expect((await renderizar(entrada)).plan?.ubicacion).toBe(UBICACION_MAPA.ultimaHoja);
    expect(await entraAlPie(entrada)).toBe(true);
  });

  test('con 11 especies el plan abre hoja nueva porque de verdad no entra', async () => {
    const entrada = entradaInforme({ parcelas: 4, especies: 11, nn: 3 });
    expect((await renderizar(entrada)).plan?.ubicacion).toBe(UBICACION_MAPA.hojaCompleta);
    expect(await entraAlPie(entrada)).toBe(false);
  });
});

test('dos documentos pedidos a la vez salen enteros, uno después del otro', async () => {
  const documento = (especies: number) => {
    const entrada = entradaInforme({ parcelas: 2, especies });
    const modelo = datosInforme(entrada);
    const encabezado = encabezadoDePlantacion(entrada.plantacion, null, LOGO_NODE);
    const props = { encabezado, emitido: '06/10/2026', modelo, mapa: mapaDe(modelo, {}) };
    return renderizarEnSerie(FUENTES_NODE, () => renderToBuffer(<DocumentoInforme {...props} />));
  };
  const [primero, segundo] = await Promise.all([documento(2), documento(3)]);
  expect(textosDelPdf(primero)).toContain('Distribución por especie · 2 especies');
  expect(textosDelPdf(segundo)).toContain('Distribución por especie · 3 especies');
});

describe('las 16 combinaciones de casillas', () => {
  const combinaciones = combinacionesDeOpciones().map(
    (opciones) => [nombreCombinacion(opciones), opciones] as const,
  );
  const conOpciones = (especies: number, opciones: OpcionesInforme) =>
    entradaInforme({ parcelas: 4, especies, nn: 3, opciones });

  test.each(combinaciones)(
    '%s, informe corto: una hoja con todo lo elegido',
    async (_, opciones) => {
      const { pdf, textos, plan } = await renderizar(conOpciones(3, opciones));
      expect(paginasDelPdf(pdf)).toBe(1);
      expect(hojasConContenido(textos)).toEqual([1]);
      expect(textos.includes(TITULO_MAPA)).toBe(opciones.mapa);
      expect(plan === null).toBe(!opciones.mapa);
      expect(textos.includes('CON GPS')).toBe(opciones.gps);
      expect(textos.includes('CON FOTO')).toBe(opciones.foto);
      expect(textos.some((texto) => texto.endsWith('de la meta'))).toBe(opciones.meta);
    },
  );

  test.each(combinaciones)('%s, informe largo: sin hojas en blanco', async (_, opciones) => {
    const { pdf, textos } = await renderizar(conOpciones(11, opciones));
    expect(paginasDelPdf(pdf)).toBe(opciones.mapa ? 2 : 1);
    expect(hojasConContenido(textos)).toEqual(hojasDel(pdf));
    if (opciones.mapa) expect(hojaDeTexto(textos, TITULO_MAPA)).toBe(2);
  });
}, 60_000);

test('ningún informe muestra parcelas ni N/N pendientes', async () => {
  for (const opciones of [opcionesCon([]), opcionesCon(['meta', 'gps', 'foto', 'mapa'])]) {
    const { textos } = await renderizar(
      entradaInforme({ parcelas: 6, especies: 3, nn: 4, opciones }),
    );
    const prohibidos = textos.filter((texto) => /parcela|pendiente|^GRUPOS$|^Total ·/i.test(texto));
    expect(prohibidos, nombreCombinacion(opciones)).toEqual([]);
    // La fila N/N de la distribución sigue.
    expect(textos).toContain('N/N · Sin identificar');
  }
});
