// Las pantallas de creación (Plantación/Parcela/Grupo) comparten un template con
// cuerpo keyboard-aware y footer fijo, para que el botón de acción no quede tapado (#89).
import * as fs from 'fs';
import * as path from 'path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../src', relativePath), 'utf-8');
}

describe('KeyboardAwareFormBody — cuerpo keyboard-aware compartido', () => {
  const src = readSrc('components/KeyboardAwareFormBody.tsx');

  it('usa useKeyboardAwareModal (bodyPadding + footerPadding)', () => {
    expect(src).toContain('useKeyboardAwareModal');
    expect(src).toMatch(/keyboard\.bodyPadding/);
    expect(src).toMatch(/keyboard\.footerPadding/);
  });

  it('renderiza un footer fijo separado del scroll', () => {
    expect(src).toMatch(/<ScrollView/);
    expect(src).toMatch(/\{footer\}/);
  });
});

describe('Formularios de creación usan el template compartido', () => {
  it('ParcelaFormModal usa EntityFormModal + FormActions y ya no monta Modal/ScrollView a mano', () => {
    const src = readSrc('components/ParcelaFormModal.tsx');
    expect(src).toContain('EntityFormModal');
    expect(src).toContain('FormActions');
    expect(src).not.toMatch(/<ScrollView/);
  });

  it('PlantationFormModal usa EntityFormModal (full-screen) y deja de usar BaseModal', () => {
    const src = readSrc('components/PlantationFormModal.tsx');
    expect(src).toContain('EntityFormModal');
    expect(src).toContain('FormActions');
    expect(src).not.toMatch(/from '\.\/BaseModal'/);
  });

  it('NuevoGrupoScreen usa el mismo EntityFormModal full-screen que las otras', () => {
    const src = readSrc('screens/NuevoGrupoScreen.tsx');
    expect(src).toContain('EntityFormModal');
    expect(src).toMatch(/footer=\{[\s\S]*FormActions/);
    // ya no es una pantalla con tab bar (que causaba el gap inferior extra)
    expect(src).not.toContain('ScreenContainer');
    expect(src).not.toContain('KeyboardAvoidingView');
  });

  it('las tres creaciones tienen botón Cancelar (FormActions onCancel)', () => {
    for (const file of [
      'components/ParcelaFormModal.tsx',
      'components/PlantationFormModal.tsx',
      'screens/NuevoGrupoScreen.tsx',
    ]) {
      expect(readSrc(file)).toMatch(/onCancel=/);
    }
  });
});

describe('GrupoForm comparte estado vía useGrupoForm', () => {
  const src = readSrc('components/GrupoForm.tsx');

  it('usa useGrupoForm + GrupoFields + FormActions (sin StyleSheet inline)', () => {
    expect(src).toContain('useGrupoForm');
    expect(src).toContain('GrupoFields');
    expect(src).toContain('FormActions');
    expect(src).not.toContain('StyleSheet.create');
  });
});
