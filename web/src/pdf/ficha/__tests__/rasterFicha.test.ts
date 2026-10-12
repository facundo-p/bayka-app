import { MEDIDA_FICHA } from '../../plantilla/tokens';
import { MEDIDA_FOTO_FICHA } from '../rasterFicha';

const PT_POR_PULGADA = 72;
/** Lado de las fotos que saca la app. */
const LADO_FOTO_APP_PX = 1200;

test('la foto impresa en la caja de la ficha sale a 250 ppp o más, sin agrandar las de la app', () => {
  const { ancho, alto } = MEDIDA_FOTO_FICHA;
  expect(alto).toBe(ancho);
  expect(ancho / (MEDIDA_FICHA.ladoImagen / PT_POR_PULGADA)).toBeGreaterThanOrEqual(250);
  expect(ancho).toBeLessThanOrEqual(LADO_FOTO_APP_PX);
});
