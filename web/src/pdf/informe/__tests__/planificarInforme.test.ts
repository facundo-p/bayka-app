import { entradaInforme, informeEnUnRenglon } from '../../../test/informePdf';
import { CAJA_MAPA_INFORME, CUERPO_HOJA, MEDIDA_INFORME } from '../../plantilla/tokens';
import { datosInforme, tieneMapa } from '../datosInforme';
import {
  altoEnUltimaHoja,
  libreMinimoAlPie,
  planificarInforme,
  planSegunLibre,
  renglonesDelFlujo,
} from '../planificarInforme';
import type { InformeConMapa } from '../renglonesInforme';

/** Con cada texto en un renglón. */
function modelo(parcelas: number, especies: number): InformeConMapa {
  const calculado = informeEnUnRenglon(datosInforme(entradaInforme({ parcelas, especies, nn: 3 })));
  if (!tieneMapa(calculado)) throw new Error('El modelo no trae el mapa');
  return calculado;
}

const plan = (parcelas: number, especies: number) => planificarInforme(modelo(parcelas, especies));

test('la caja del mapa es 16:9 horizontal, al ancho del cuerpo', () => {
  expect(CAJA_MAPA_INFORME.ancho).toBe(CUERPO_HOJA.ancho);
  expect(CAJA_MAPA_INFORME.ancho / CAJA_MAPA_INFORME.alto).toBeCloseTo(16 / 9);
});

// Solo las especies empujan el mapa. El borde contra el render real está en
// DocumentoInforme.test.tsx.
test.each([
  [1, 'ultima-hoja'],
  [10, 'ultima-hoja'],
  [11, 'hoja-completa'],
])('%i especies y N/N: el mapa va a %s', (especies, ubicacion) => {
  expect(plan(4, especies).ubicacion).toBe(ubicacion);
});

describe('en el umbral de lo libre', () => {
  const cuatro = modelo(4, 4);
  const umbral = libreMinimoAlPie(cuatro);

  test('justo en el umbral va al pie', () => {
    expect(planSegunLibre(cuatro, umbral).ubicacion).toBe('ultima-hoja');
  });

  test('medio punto menos ya va a hoja completa', () => {
    expect(planSegunLibre(cuatro, umbral - 0.5).ubicacion).toBe('hoja-completa');
  });

  test('una leyenda de más renglones sube el umbral', () => {
    const muchas = modelo(4, 18);
    expect(libreMinimoAlPie(muchas)).toBeGreaterThan(umbral);
    expect(planSegunLibre(muchas, umbral).ubicacion).toBe('hoja-completa');
  });
});

test('la leyenda pasa a dos renglones con 11 ítems', () => {
  // 9 y 10 especies, más N/N: entran 10 por renglón.
  const diferencia = libreMinimoAlPie(modelo(4, 10)) - libreMinimoAlPie(modelo(4, 9));
  expect(diferencia).toBe(MEDIDA_INFORME.altoRenglonLeyenda);
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
  const altos = (otro: InformeConMapa) => renglonesDelFlujo(otro).map(({ alto }) => alto);
  const diferencias = (otro: InformeConMapa) => {
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

  // 7,5 pt de letra con interlineado de 1,25.
  test('un código en 2 renglones sube su fila de la leyenda, esté donde esté, y dos en la misma también', () => {
    const conCodigos = (partidos: number[]) => {
      const leyenda = base.mapa.leyenda.map((item, indice) =>
        partidos.includes(indice) ? { ...item, texto: renglones(2) } : item,
      );
      return { ...base, mapa: { ...base.mapa, leyenda } };
    };
    const umbral = libreMinimoAlPie(base);
    expect(libreMinimoAlPie(conCodigos([0])) - umbral).toBeCloseTo(9.375);
    expect(libreMinimoAlPie(conCodigos([3])) - umbral).toBeCloseTo(9.375);
    expect(libreMinimoAlPie(conCodigos([0, 3])) - umbral).toBeCloseTo(9.375);
  });
});
