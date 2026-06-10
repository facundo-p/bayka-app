/**
 * #85 — el back del SO desde listados caía en Catálogo porque los headers usaban
 * router.navigate(destinoFijo) (no hace pop) y dejaba pantallas colgadas en el
 * stack `plantation`. El fix unifica el "atrás" en useGoBack (router.back con
 * fallback). Tests estáticos sobre el source.
 */
import * as fs from 'fs';
import * as path from 'path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../src', relativePath), 'utf-8');
}

describe('useGoBack — pop real con fallback', () => {
  const hook = readSrc('hooks/useGoBack.ts');

  it('hace router.back() cuando hay historial', () => {
    expect(hook).toMatch(/canGoBack\(\)/);
    expect(hook).toMatch(/router\.back\(\)/);
  });

  it('usa el fallbackHref solo si no se puede volver', () => {
    expect(hook).toMatch(/else\s+router\.navigate\(fallbackHref/);
  });
});

describe('Screens usan useGoBack en el header (no navigate a un destino fijo)', () => {
  const screens = [
    'screens/ParcelasScreen.tsx',
    'screens/CatalogScreen.tsx',
    'screens/PlantationDetailScreen.tsx',
  ];

  it.each(screens)('%s importa y usa useGoBack', (file) => {
    const src = readSrc(file);
    expect(src).toContain("from '../hooks/useGoBack'");
    expect(src).toMatch(/useGoBack\(/);
    expect(src).toMatch(/onBack=\{goBack\}/);
  });

  it.each(screens)('%s ya no hace router.navigate al header back', (file) => {
    const src = readSrc(file);
    expect(src).not.toMatch(/onBack=\{\(\)\s*=>\s*router\.navigate/);
  });
});
