/**
 * Regression tests for Phase 9 refactor.
 * These tests verify that functionality extracted from screens to hooks
 * was properly wired back. Each test catches a specific regression that
 * occurred during the Phase 9 hook extraction.
 */
import * as fs from 'fs';
import * as path from 'path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../src', relativePath), 'utf-8');
}

// --- Regression 1: pendingEdit workflow (moved from AdminScreen to AdminBottomSheet in Phase 11) ---
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
    // Extract handleRefresh function body
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

// --- Regression 4-8: Safe area on refactored screens ---
// Safe area is handled by ScreenContainer/ScreenHeader/CustomHeader wrappers,
// not directly in each screen. Verify screens use these wrappers.
describe('Safe area on refactored screens', () => {
  const screens = {
    TreeRegistrationScreen: readSrc('screens/TreeRegistrationScreen.tsx'),
    NNResolutionScreen: readSrc('screens/NNResolutionScreen.tsx'),
    NuevoSubgrupoScreen: readSrc('screens/NuevoSubgrupoScreen.tsx'),
    PlantationDetailScreen: readSrc('screens/PlantationDetailScreen.tsx'),
  };

  for (const [name, source] of Object.entries(screens)) {
    it(`${name} uses ScreenContainer or safe area wrapper`, () => {
      const usesSafeArea =
        source.includes('ScreenContainer') ||
        source.includes('useSafeAreaInsets') ||
        source.includes('SafeAreaView');
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

// --- Regression 9: CatalogScreen safe area handling ---
// CatalogScreen uses ScreenContainer + ScreenHeader which handle safe area internally.
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
    expect(screen).toContain('onDelete=');
  });

  it('hook exports handleDeletePlantation', () => {
    expect(hook).toMatch(/return\s*\{[\s\S]*handleDeletePlantation[\s\S]*\}/);
  });
});
