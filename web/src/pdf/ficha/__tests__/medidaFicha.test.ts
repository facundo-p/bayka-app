import { CUERPO_HOJA, MEDIDA_FICHA } from '../../plantilla/tokens';

test('la columna de datos y las imágenes entran en el cuerpo de la hoja', () => {
  const { anchoTexto, ladoImagen, huecoImagenes } = MEDIDA_FICHA;
  expect(anchoTexto + ladoImagen).toBeLessThanOrEqual(CUERPO_HOJA.ancho);
  expect(2 * ladoImagen + huecoImagenes).toBeLessThanOrEqual(CUERPO_HOJA.alto);
});
