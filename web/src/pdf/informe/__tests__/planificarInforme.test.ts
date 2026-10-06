import { entradaInforme } from '../../../test/informePdf';
import { CUERPO_HOJA, MEDIDA_INFORME } from '../../plantilla/tokens';
import { datosInforme } from '../datosInforme';
import { altoEnUltimaHoja, planificarInforme, UBICACION_MAPA } from '../planificarInforme';

const plan = (parcelas: number, especies: number) =>
  planificarInforme(datosInforme(entradaInforme({ parcelas, especies, nn: 3 })));

test('4 parcelas y 4 especies: el mapa va al pie de la hoja 1, con al menos 7 cm', () => {
  const resultado = plan(4, 4);
  expect(resultado.ubicacion).toBe(UBICACION_MAPA.ultimaHoja);
  expect(resultado.disponible.alto).toBeGreaterThanOrEqual(MEDIDA_INFORME.altoMinimoMapa);
  expect(resultado.disponible.ancho).toBe(CUERPO_HOJA.ancho);
});

test('17 parcelas y 9 especies: el mapa va a hoja completa', () => {
  const resultado = plan(17, 9);
  expect(resultado.ubicacion).toBe(UBICACION_MAPA.hojaCompleta);
  expect(resultado.disponible.alto).toBeGreaterThan(CUERPO_HOJA.alto * 0.8);
});

test('muchas especies empujan el mapa a hoja completa aunque haya pocas parcelas', () => {
  expect(plan(2, 18).ubicacion).toBe(UBICACION_MAPA.hojaCompleta);
});

test('un renglón que no entra empieza la hoja siguiente', () => {
  const casiLlena = CUERPO_HOJA.alto - 10;
  expect(altoEnUltimaHoja([casiLlena, 20, 30])).toBe(50);
  expect(altoEnUltimaHoja([100, 200])).toBe(300);
});
