/**
 * Regression tests for functionality extracted from screens into hooks —
 * each test catches a specific case that broke during that extraction.
 */
import * as fs from 'fs';
import * as path from 'path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../src', relativePath), 'utf-8');
}

// --- Regression: pendingEdit workflow moved from AdminScreen to AdminBottomSheet ---
describe('AdminBottomSheet — pendingEdit workflow', () => {
  const hook = readSrc('hooks/usePlantationAdmin.ts');
  const sheet = readSrc('components/AdminBottomSheet.tsx');

  it('hook imports discardPlantationEdit', () => {
    expect(hook).toContain('discardPlantationEdit');
  });

  it('hook exports handleDiscardEdit', () => {
    expect(hook).toMatch(/return\s*\{[\s\S]*handleDiscardEdit[\s\S]*\}/);
  });

  it('hook checks pendingEdit in handleFinalize', () => {
    expect(hook).toMatch(/pendingEdit/);
  });

  it('sheet accepts onDiscardEdit prop', () => {
    expect(sheet).toContain('onDiscardEdit');
  });

  it('sheet renders pending sync/edit badge', () => {
    expect(sheet).toContain('Pendiente de sync');
    expect(sheet).toContain('Cambios sin sincronizar');
  });

  it('sheet disables Finalize when pendingSync or pendingEdit', () => {
    expect(sheet).toMatch(/pendingSync.*pendingEdit|pendingEdit.*pendingSync/);
  });
});

// --- Regression 2: PlantacionesScreen uploadPendingEdits ---
describe('PlantacionesScreen — uploadPendingEdits in refresh', () => {
  const hook = readSrc('hooks/usePlantaciones.ts');

  it('imports uploadPendingEdits', () => {
    expect(hook).toContain('uploadPendingEdits');
  });

  it('calls uploadPendingEdits in handleRefresh', () => {
    const refreshMatch = hook.match(/handleRefresh[\s\S]*?try\s*\{([\s\S]*?)for/);
    expect(refreshMatch).not.toBeNull();
    expect(refreshMatch![1]).toContain('uploadPendingEdits');
  });
});

// --- Regression 3: CatalogScreen localIds reactivity ---
describe('CatalogScreen — localIds reactivity', () => {
  const hook = readSrc('hooks/useCatalog.ts');

  it('uses useLiveData for localIds (not plain useState)', () => {
    expect(hook).toContain('useLiveData');
    expect(hook).toMatch(/useLiveData.*getLocalPlantationIds/);
  });

  it('does not use useState for localIds', () => {
    expect(hook).not.toMatch(/useState.*localIds|localIds.*useState/);
  });
});

// --- Regression: safe area handled by ScreenContainer/ScreenHeader/CustomHeader wrappers, not per-screen ---
describe('Safe area on refactored screens', () => {
  const screens = {
    TreeRegistrationScreen: readSrc('screens/TreeRegistrationScreen.tsx'),
    NNResolutionScreen: readSrc('screens/NNResolutionScreen.tsx'),
    NuevoGrupoScreen: readSrc('screens/NuevoGrupoScreen.tsx'),
    PlantationDetailScreen: readSrc('screens/PlantationDetailScreen.tsx'),
  };

  for (const [name, source] of Object.entries(screens)) {
    it(`${name} uses ScreenContainer or safe area wrapper`, () => {
      const usesSafeArea =
        source.includes('ScreenContainer') ||
        source.includes('useSafeAreaInsets') ||
        source.includes('SafeAreaView') ||
        // EntityFormModal también encapsula el safe-area para pantallas de creación (#89)
        source.includes('EntityFormModal');
      expect(usesSafeArea).toBe(true);
    });
  }
});

// --- Regression 5: NNResolutionScreen selection count ---
describe('NNResolutionScreen — Guardar selection count', () => {
  const screen = readSrc('screens/NNResolutionScreen.tsx');

  it('destructures selections from hook', () => {
    expect(screen).toContain('selections');
  });

  it('shows selection count in Guardar button', () => {
    expect(screen).toMatch(/Guardar.*selections/s);
  });
});

// --- Regression: CatalogScreen safe area via ScreenContainer + ScreenHeader ---
describe('CatalogScreen — safe area handling', () => {
  const screen = readSrc('screens/CatalogScreen.tsx');

  it('uses ScreenContainer or SafeAreaView for safe area', () => {
    const usesSafeArea =
      screen.includes('ScreenContainer') ||
      screen.includes('SafeAreaView') ||
      screen.includes('ScreenHeader');
    expect(usesSafeArea).toBe(true);
  });
});

// --- Original regression: PlantacionesScreen delete ---
describe('PlantacionesScreen — delete local', () => {
  const screen = readSrc('screens/PlantacionesScreen.tsx');
  const hook = readSrc('hooks/usePlantaciones.ts');

  it('passes onDelete prop to PlantationCard', () => {
    // Matches both prop-style (`onDelete=`) and object-property-style (`onDelete:`),
    // since onDelete lives inside a cardProps object literal on ExpandablePlantationCard.
    expect(screen).toMatch(/onDelete\s*[:=]/);
  });

  it('hook exports handleDeletePlantation', () => {
    expect(hook).toMatch(/return\s*\{[\s\S]*handleDeletePlantation[\s\S]*\}/);
  });
});
