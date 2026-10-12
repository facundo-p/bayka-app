// @vitest-environment node
import { valorDelToken } from '../../../test/tokensTema';
import {
  COLOR_PDF,
  CUERPO_HOJA,
  cuerpoDeHoja,
  ORIENTACION_HOJA,
  TOKEN_CSS_DE_COLOR_PDF,
} from '../tokens';

test.each(Object.entries(TOKEN_CSS_DE_COLOR_PDF))(
  'COLOR_PDF.%s es el mismo color que %s de theme.css',
  (color, token) => {
    expect(COLOR_PDF[color as keyof typeof TOKEN_CSS_DE_COLOR_PDF]).toBe(valorDelToken(token));
  },
);

test('el cuerpo de la hoja, parada y acostada', () => {
  expect(CUERPO_HOJA).toEqual({ ancho: 535, alto: 704 });
  expect(cuerpoDeHoja(ORIENTACION_HOJA.vertical)).toEqual(CUERPO_HOJA);
  expect(cuerpoDeHoja(ORIENTACION_HOJA.horizontal)).toEqual({ ancho: 782, alto: 457 });
});
