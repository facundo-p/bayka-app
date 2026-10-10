import { entradaInforme } from '../../../test/informePdf';
import { CAJA_MAPA_INFORME, CUERPO_HOJA, MEDIDA_INFORME } from '../../plantilla/tokens';
import { datosInforme } from '../datosInforme';
import {
  altoEnUltimaHoja,
  libreMinimoAlPie,
  planificarInforme,
  planSegunLibre,
} from '../planificarInforme';

const modelo = (parcelas: number, especies: number) =>
  datosInforme(entradaInforme({ parcelas, especies, nn: 3 }));
const plan = (parcelas: number, especies: number) => planificarInforme(modelo(parcelas, especies));

test('la caja del mapa es 16:9 horizontal, al ancho del cuerpo', () => {
  expect(CAJA_MAPA_INFORME.ancho).toBe(CUERPO_HOJA.ancho);
  expect(CAJA_MAPA_INFORME.ancho / CAJA_MAPA_INFORME.alto).toBeCloseTo(16 / 9);
});

test('una parcela y una especie: el mapa va al pie de la hoja 1', () => {
  expect(plan(1, 1).ubicacion).toBe('ultima-hoja');
});

test('17 parcelas y 9 especies: el mapa va a hoja completa', () => {
  expect(plan(17, 9).ubicacion).toBe('hoja-completa');
});

test('muchas especies empujan el mapa a hoja completa aunque haya pocas parcelas', () => {
  expect(plan(2, 18).ubicacion).toBe('hoja-completa');
});

describe('en el umbral de lo libre', () => {
  const cuatro = modelo(4, 4);
  const umbral = libreMinimoAlPie(cuatro);

  test('el umbral es el mapa 16:9 más título, leyenda y nota', () => {
    expect(umbral).toBeGreaterThan(CAJA_MAPA_INFORME.alto);
  });

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
  const renglon = (alto: number, alEmpezarHoja = 0) => ({ alto, alEmpezarHoja });

  test('un renglón que no entra empieza la hoja siguiente', () => {
    const casiLlena = CUERPO_HOJA.alto - 10;
    expect(altoEnUltimaHoja([renglon(casiLlena), renglon(20), renglon(30)])).toBe(50);
    expect(altoEnUltimaHoja([renglon(100), renglon(200)])).toBe(300);
  });

  test('si abre hoja, suma lo que se repite arriba (el encabezado de la tabla)', () => {
    const casiLlena = CUERPO_HOJA.alto - 10;
    expect(altoEnUltimaHoja([renglon(casiLlena), renglon(16, 14), renglon(16, 14)])).toBe(46);
  });
});
