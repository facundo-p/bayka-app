import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// vitest corre con cwd en `web/`.
const THEME_CSS = readFileSync(join(process.cwd(), 'src/theme/theme.css'), 'utf8');

const ALIAS = /^var\((--[\w-]+)\)$/;

/**
 * Valor de un token de theme.css, en minúsculas. Un alias (`var(--otro)`) se
 * resuelve al valor del token al que apunta.
 */
export function valorDelToken(token: string): string | undefined {
  const valor = THEME_CSS.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]
    .trim()
    .toLowerCase();
  const alias = valor && ALIAS.exec(valor)?.[1];
  return alias ? valorDelToken(alias) : valor;
}
