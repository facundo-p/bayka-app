import { CUERPO_HOJA, MEDIDA_FICHA } from '../../plantilla/tokens';

const { anchoTexto, huecoColumnas, ladoImagen, huecoImagenes } = MEDIDA_FICHA;

test('la columna de datos, el hueco y las imágenes llenan el ancho del cuerpo', () => {
  // Menos de 1 pt de sobra: el A4 de react-pdf mide 595,28 pt y no un entero.
  const sobra = CUERPO_HOJA.ancho - (anchoTexto + huecoColumnas + ladoImagen);
  expect(sobra).toBeGreaterThanOrEqual(0);
  expect(sobra).toBeLessThan(1);
});

test('la foto y el minimapa, uno sobre otro, entran en el alto del cuerpo', () => {
  expect(2 * ladoImagen + huecoImagenes).toBeLessThanOrEqual(CUERPO_HOJA.alto);
});
