/**
 * #85 — el back del SO desde listados caía en Catálogo: el stack `plantation`
 * acumula pantallas (catalog queda colgado) y un pop del SO iba a la equivocada.
 * Fix: useScreenBack — header + back de hardware van al MISMO destino explícito
 * (el padre lógico), interceptando el back del SO. Tests estáticos sobre source.
 */
import * as fs from 'fs';
import * as path from 'path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../src', relativePath), 'utf-8');
}

describe('useScreenBack — atrás jerárquico que intercepta el back de hardware', () => {
  const hook = readSrc('hooks/useScreenBack.ts');

  it('intercepta el back de hardware con BackHandler dentro de useFocusEffect', () => {
    expect(hook).toMatch(/useFocusEffect/);
    expect(hook).toMatch(/BackHandler\.addEventListener\('hardwareBackPress'/);
    expect(hook).toMatch(/return true/); // previene el pop por defecto
  });

  it('navega al destino explícito (no hace pop del stack)', () => {
    expect(hook).toMatch(/router\.navigate\(target/);
    expect(hook).not.toMatch(/router\.back\(\)/);
  });
});

describe('Screens del stack plantation usan useScreenBack', () => {
  const screens = [
    'screens/ParcelasScreen.tsx',
    'screens/CatalogScreen.tsx',
    'screens/PlantationDetailScreen.tsx',
  ];

  it.each(screens)('%s importa useScreenBack y lo usa en el header', (file) => {
    const src = readSrc(file);
    expect(src).toContain("from '../hooks/useScreenBack'");
    expect(src).toMatch(/useScreenBack\(/);
    expect(src).toMatch(/onBack=\{goBack\}/);
  });

  it.each(screens)('%s ya no hace router.navigate/back inline en el header', (file) => {
    const src = readSrc(file);
    expect(src).not.toMatch(/onBack=\{\(\)\s*=>\s*router\.(navigate|back)/);
  });
});
