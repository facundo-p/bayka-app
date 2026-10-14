// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const THEME_CSS = readFileSync(resolve(__dirname, '../theme.css'), 'utf8');

function capa(token: string): number {
  const valor = THEME_CSS.match(new RegExp(`--z-${token}:\\s*(\\d+);`))?.[1];
  if (valor === undefined) throw new Error(`Falta --z-${token} en theme.css`);
  return Number(valor);
}

/*
 * La hoja de detalle de un listado tapa el chrome de la app, pero nunca a un
 * diálogo: ni a los que abre ella ni a uno de la pantalla que ya estaba abierto
 * cuando se cruzó a ≤900 (#823).
 */
test('el detalle en hoja queda entre el chrome y los diálogos', () => {
  expect(capa('detalle')).toBeGreaterThan(capa('topbar'));
  expect(capa('detalle')).toBeGreaterThan(capa('banner-entorno'));
  expect(capa('detalle')).toBeLessThan(capa('modal'));
  expect(capa('modal')).toBeLessThan(capa('popover'));
});
