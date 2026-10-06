import { entradaInforme } from '../../../test/informePdf';
import { CUERPO_HOJA, MEDIDA_INFORME } from '../../plantilla/tokens';
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

test('4 parcelas y 4 especies: el mapa va al pie de la hoja 1, con al menos 7 cm', () => {
  const resultado = plan(4, 4);
  expect(resultado.ubicacion).toBe('ultima-hoja');
  expect(resultado.disponible.alto).toBeGreaterThanOrEqual(MEDIDA_INFORME.altoMinimoMapa);
  expect(resultado.disponible.ancho).toBe(CUERPO_HOJA.ancho);
});

test('17 parcelas y 9 especies: el mapa va a hoja completa', () => {
  const resultado = plan(17, 9);
  expect(resultado.ubicacion).toBe('hoja-completa');
  expect(resultado.disponible.alto).toBeGreaterThan(CUERPO_HOJA.alto * 0.8);
});

test('muchas especies empujan el mapa a hoja completa aunque haya pocas parcelas', () => {
  expect(plan(2, 18).ubicacion).toBe('hoja-completa');
});

describe('en el umbral de lo libre', () => {
  const cuatro = modelo(4, 4);
  const umbral = libreMinimoAlPie(cuatro);

  test('justo en el umbral va al pie, con el mapa de 7 cm exactos', () => {
    const resultado = planSegunLibre(cuatro, umbral);
    expect(resultado.ubicacion).toBe('ultima-hoja');
    expect(resultado.disponible.alto).toBe(198);
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

test('la leyenda deja lugar a la atribución del satélite: 9 ítems ya ocupan dos renglones', () => {
  // 7 y 8 especies, más N/N. Sin la columna de la atribución entrarían 10 por renglón.
  const diferencia = libreMinimoAlPie(modelo(4, 8)) - libreMinimoAlPie(modelo(4, 7));
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
