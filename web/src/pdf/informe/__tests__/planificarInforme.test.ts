import { entradaInforme, informeEnUnRenglon } from '../../../test/informePdf';
import { CAJA_MAPA_INFORME, CUERPO_HOJA } from '../../plantilla/tokens';
import { datosInforme } from '../datosInforme';
import {
  altoEnUltimaHoja,
  LIBRE_MINIMO_AL_PIE,
  planificarInforme,
  planSegunLibre,
  renglonesDelFlujo,
} from '../planificarInforme';
import type { InformeEnRenglones } from '../renglonesInforme';

/** Con cada texto en un renglón. */
const modelo = (parcelas: number, especies: number): InformeEnRenglones =>
  informeEnUnRenglon(datosInforme(entradaInforme({ parcelas, especies, nn: 3 })));

const plan = (parcelas: number, especies: number) => planificarInforme(modelo(parcelas, especies));

test('la caja del mapa es 16:9 horizontal, al ancho del cuerpo', () => {
  expect(CAJA_MAPA_INFORME.ancho).toBe(CUERPO_HOJA.ancho);
  expect(CAJA_MAPA_INFORME.ancho / CAJA_MAPA_INFORME.alto).toBeCloseTo(16 / 9);
});

// Solo las especies empujan el mapa. El borde contra el render real está en
// DocumentoInforme.test.tsx.
test.each([
  [1, 'ultima-hoja'],
  [12, 'ultima-hoja'],
  [13, 'hoja-completa'],
])('%i especies y N/N: el mapa va a %s', (especies, ubicacion) => {
  expect(plan(4, especies).ubicacion).toBe(ubicacion);
});

describe('en el umbral de lo libre', () => {
  // Separación 14, título de bloque 24, aire 4, nota 11 y holgura 8, más la caja del mapa.
  test('lo libre que pide el mapa al pie no depende de las especies', () => {
    expect(LIBRE_MINIMO_AL_PIE - CAJA_MAPA_INFORME.alto).toBe(61);
  });

  test('justo en el umbral va al pie', () => {
    expect(planSegunLibre(LIBRE_MINIMO_AL_PIE).ubicacion).toBe('ultima-hoja');
  });

  test('medio punto menos ya va a hoja completa', () => {
    expect(planSegunLibre(LIBRE_MINIMO_AL_PIE - 0.5).ubicacion).toBe('hoja-completa');
  });
});

describe('altoEnUltimaHoja', () => {
  const renglon = (alto: number) => ({ alto });

  test('un renglón que no entra empieza la hoja siguiente', () => {
    const casiLlena = CUERPO_HOJA.alto - 10;
    expect(altoEnUltimaHoja([renglon(casiLlena), renglon(20), renglon(30)])).toBe(50);
    expect(altoEnUltimaHoja([renglon(100), renglon(200)])).toBe(300);
  });

  test('la presencia decide si salta de hoja, pero no suma al alto ocupado', () => {
    const casiLlena = CUERPO_HOJA.alto - 30;
    const titulo = { alto: 20, presencia: 50 };
    expect(altoEnUltimaHoja([renglon(100), titulo])).toBe(120);
    expect(altoEnUltimaHoja([renglon(casiLlena), titulo])).toBe(20);
  });
});

describe('con textos en más de un renglón', () => {
  const base = modelo(4, 4);
  const renglones = (cantidad: number) => Array.from({ length: cantidad }, () => 'Loma');
  const altos = (otro: InformeEnRenglones) => renglonesDelFlujo(otro).map(({ alto }) => alto);
  const diferencias = (otro: InformeEnRenglones) => {
    const deBase = altos(base);
    return altos(otro).map((alto, indice) => alto - deBase[indice]);
  };

  // 8,5 pt de letra con interlineado de 1,25.
  test('la línea del título en 2 renglones suma 10,625 pt al título', () => {
    expect(diferencias({ ...base, linea: renglones(2) })[0]).toBeCloseTo(10.625);
  });

  // 8 pt de letra con interlineado de 1,25: 10 pt por renglón de más.
  test('un nombre de especie en 3 renglones suma 20 pt a su fila, y solo a la suya', () => {
    const filas = base.especies.filas.map((fila, indice) =>
      indice === 1 ? { ...fila, titulo: renglones(3) } : fila,
    );
    const partido = { ...base, especies: { ...base.especies, filas } };
    // Título, indicadores, encabezado con la primera fila, y las demás.
    expect(diferencias(partido)).toEqual([0, 0, 0, 20, 0, 0, 0]);
  });
});
