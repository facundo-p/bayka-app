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

// El A4 de react-pdf mide 595,28 × 841,89 pt.
test('el cuerpo de la hoja, parada y acostada', () => {
  expect(CUERPO_HOJA.ancho).toBeCloseTo(535.28);
  expect(CUERPO_HOJA.alto).toBeCloseTo(703.89);
  expect(cuerpoDeHoja(ORIENTACION_HOJA.vertical)).toEqual(CUERPO_HOJA);
  const acostada = cuerpoDeHoja(ORIENTACION_HOJA.horizontal);
  expect(acostada.ancho).toBeCloseTo(781.89);
  expect(acostada.alto).toBeCloseTo(457.28);
});
