import { CUERPO_HOJA, MEDIDA_FICHA } from '../../plantilla/tokens';

const { anchoTexto, huecoColumnas, ladoImagen, huecoImagenes } = MEDIDA_FICHA;

test('la columna de datos, el hueco y las imágenes llenan justo el ancho del cuerpo', () => {
  expect(anchoTexto + huecoColumnas + ladoImagen).toBe(CUERPO_HOJA.ancho);
});

test('la foto y el minimapa, uno sobre otro, entran en el alto del cuerpo', () => {
  expect(2 * ladoImagen + huecoImagenes).toBeLessThanOrEqual(CUERPO_HOJA.alto);
});
