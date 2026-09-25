// Alta, edición y borrado de parcela quedan deshabilitados con la plantación
// finalizada o archivada (#469, #477), mismo criterio que Grupos. Editar y
// borrar además son de admin (#640), salvo el alta propia sin subir (#654).
//
// Son aserciones sobre el fuente, no sobre el render: la pantalla arrastra router,
// modales y varias queries. El comportamiento del guard está en
// tests/components/ParcelaRow.test.tsx y en tests/utils/permisosDeEdicion.test.ts.
import * as fs from 'fs';
import * as path from 'path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../src', relativePath), 'utf-8');
}

describe('ParcelasScreen — gating por estado finalizada', () => {
  const screen = readSrc('screens/ParcelasScreen.tsx');

  // El hook lo deriva con plantacionEsEditable, que cubre finalizada y archivada:
  // ver tests/hooks/usePlantationDetail.test.ts.
  it('toma plantacionEditable de usePlantationDetail, sin derivarlo a mano', () => {
    expect(screen).toMatch(/\{[^}]*plantacionEditable[^}]*\}\s*=\s*usePlantationDetail\(pid\)/);
    expect(screen).not.toMatch(/isFinalizada/);
  });

  it('oculta el "+" del header cuando no se puede agregar', () => {
    expect(screen).toMatch(/plantacionEditable\s*\?\s*\(\s*<HeaderActionButton/);
  });

  it('no ofrece el CTA del empty-state cuando no se puede agregar', () => {
    expect(screen).toMatch(/plantacionEditable\s*\?\s*openCreate\s*:\s*null/);
  });

  it('las guardas están en los handlers, no solo en el render', () => {
    expect(screen).toMatch(/function openEdit[\s\S]{0,80}if \(!puedeEditar\(p\)\) return;/);
    expect(screen).toMatch(/function openCreate[\s\S]{0,80}if \(!plantacionEditable\) return;/);
  });

  it('no entrega onLongPress —la puerta a editar y eliminar— si no es editable', () => {
    expect(screen).toMatch(/onLongPress=\{puedeEditar\(item\)\s*\?\s*\(\)\s*=>\s*openEdit\(item\)\s*:\s*undefined\}/);
  });

  it('editar exige plantación editable y el predicado por parcela; crear, solo plantación editable', () => {
    expect(screen).toMatch(/const puedeEditarParcela = usePuedeEditarParcela\(routePrefix\);/);
    expect(screen).toMatch(/const puedeEditar = \(p: Parcela\) => plantacionEditable && puedeEditarParcela\(p\);/);
    expect(screen).toMatch(/function openCreate[\s\S]{0,80}if \(!plantacionEditable\) return;/);
  });
});

describe('PlantacionesScreen — parcela inline del card expandido', () => {
  const screen = readSrc('screens/PlantacionesScreen.tsx');

  // Segunda entrada a la misma edición: desde el listado de plantaciones, sin
  // pasar por la pantalla de parcelas.
  it('no entrega onParcelaLongPress sobre una plantación finalizada', () => {
    expect(screen).toMatch(/onParcelaLongPress=\{plantacionEsEditable\(item\)/);
  });

  it('filtra el long-press por parcela con el mismo predicado que ParcelasScreen', () => {
    expect(screen).toMatch(/parcelaEditable=\{s\.puedeEditarParcela\}/);
    const hook = readSrc('hooks/usePlantacionesScreen.ts');
    expect(hook).toMatch(/const puedeEditarParcela = usePuedeEditarParcela\(routePrefix\);/);
    expect(hook).toMatch(/handleParcelaInlineLongPress[\s\S]{0,120}if \(!puedeEditarParcela\(parcela\)\) return;/);
  });
});
