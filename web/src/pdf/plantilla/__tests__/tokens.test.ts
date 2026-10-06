// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COLOR_PDF, TOKEN_CSS_DE_COLOR_PDF } from '../tokens';

const THEME_CSS = readFileSync(resolve(__dirname, '../../../theme/theme.css'), 'utf8');

function valorDelToken(token: string): string | undefined {
  return THEME_CSS.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]
    .trim()
    .toLowerCase();
}

test.each(Object.entries(TOKEN_CSS_DE_COLOR_PDF))(
  'COLOR_PDF.%s es el mismo color que %s de theme.css',
  (color, token) => {
    expect(COLOR_PDF[color as keyof typeof TOKEN_CSS_DE_COLOR_PDF]).toBe(valorDelToken(token));
  },
);
