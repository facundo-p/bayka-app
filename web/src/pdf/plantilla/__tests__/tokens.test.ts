// @vitest-environment node
import { valorDelToken } from '../../../test/tokensTema';
import { COLOR_PDF, TOKEN_CSS_DE_COLOR_PDF } from '../tokens';

test.each(Object.entries(TOKEN_CSS_DE_COLOR_PDF))(
  'COLOR_PDF.%s es el mismo color que %s de theme.css',
  (color, token) => {
    expect(COLOR_PDF[color as keyof typeof TOKEN_CSS_DE_COLOR_PDF]).toBe(valorDelToken(token));
  },
);
