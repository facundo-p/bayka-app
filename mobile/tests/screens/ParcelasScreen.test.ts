// El alta de parcela debe deshabilitarse con la plantación finalizada
// (mismo criterio que Grupos: canAddGroup = estadoLoaded && !isFinalizada).
import * as fs from 'fs';
import * as path from 'path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../src', relativePath), 'utf-8');
}

describe('ParcelasScreen — gating de alta por estado finalizada', () => {
  const screen = readSrc('screens/ParcelasScreen.tsx');

  it('toma estadoLoaded e isFinalizada de usePlantationDetail', () => {
    expect(screen).toMatch(/usePlantationDetail\(pid\)/);
    expect(screen).toMatch(/estadoLoaded[\s\S]*isFinalizada/);
  });

  it('deriva canAddParcela = estadoLoaded && !isFinalizada', () => {
    expect(screen).toMatch(/canAddParcela\s*=\s*estadoLoaded\s*&&\s*!isFinalizada/);
  });

  it('oculta el "+" del header cuando no se puede agregar', () => {
    expect(screen).toMatch(/canAddParcela\s*\?\s*\(\s*<HeaderActionButton/);
  });

  it('no ofrece el CTA del empty-state cuando no se puede agregar', () => {
    expect(screen).toMatch(/canAddParcela\s*\?\s*openCreate\s*:\s*null/);
  });
});
