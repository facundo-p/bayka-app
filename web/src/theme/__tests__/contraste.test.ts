// @vitest-environment node
import { CONTRASTE_AA_TEXTO, contraste } from '../../test/contrasteWcag';
import { valorDelToken } from '../../test/tokensTema';

/** Texto chico y apagado: rótulos, metadatos y textos vacíos (#824). */
const TEXTOS_APAGADOS = ['--color-text-secondary', '--color-text-muted', '--color-text-faint'];

/** Fondos claros sobre los que la web pone esos textos. */
const FONDOS_CLAROS = [
  '--color-surface',
  '--color-background',
  '--color-sidebar-bg',
  '--color-surface-sunken',
  '--color-surface-tint',
  '--color-divider',
  '--color-secondary-bg',
  '--color-primary-bg',
  '--color-warn-bg',
];

/** Blancos translúcidos del recuadro azul del dashboard. */
const TEXTOS_SOBRE_PRIMARIO = ['--color-on-primary-strong', '--color-on-primary-soft'];

function color(token: string): string {
  const valor = valorDelToken(token);
  if (!valor) throw new Error(`${token} no está en theme.css`);
  return valor;
}

describe('contraste()', () => {
  test('da los extremos de la escala WCAG', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contraste('#ffffff', '#ffffff')).toBe(1);
  });

  test('es simétrico entre texto y fondo opacos', () => {
    expect(contraste('#6e6a5e', '#ffffff')).toBeCloseTo(contraste('#ffffff', '#6e6a5e'), 10);
    expect(contraste('#6e6a5e', '#ffffff')).toBeCloseTo(5.4, 1);
  });

  test('pinta el texto translúcido sobre el fondo antes de medir', () => {
    expect(contraste('rgba(0, 0, 0, 0)', '#0a3760')).toBe(1);
    expect(contraste('rgba(255, 255, 255, 1)', '#000000')).toBeCloseTo(21, 5);
  });

  test('rechaza lo que no sabe leer en vez de medir mal', () => {
    expect(() => contraste('#fff', '#ffffff')).toThrow('no soportado');
    expect(() => contraste('rgba(1, 2)', '#ffffff')).toThrow('no soportado');
    expect(() => contraste('var(--color-x, #000000)', '#ffffff')).toThrow('no soportado');
    expect(() => contraste('#000000', 'rgba(255, 255, 255, 0.5)')).toThrow('opaco');
  });
});

const PARES_CLAROS = TEXTOS_APAGADOS.flatMap((texto) =>
  FONDOS_CLAROS.map((fondo) => [texto, fondo]),
);

test.each(PARES_CLAROS)('%s sobre %s llega a AA', (texto, fondo) => {
  expect(contraste(color(texto), color(fondo))).toBeGreaterThanOrEqual(CONTRASTE_AA_TEXTO);
});

test.each(TEXTOS_SOBRE_PRIMARIO)('%s sobre --color-primary llega a AA', (texto) => {
  expect(contraste(color(texto), color('--color-primary'))).toBeGreaterThanOrEqual(
    CONTRASTE_AA_TEXTO,
  );
});
