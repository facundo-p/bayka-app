/**
 * Regression tests for functionality extracted from screens into hooks —
 * each test catches a specific case that broke during that extraction.
 */
import * as fs from 'fs';
import * as path from 'path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../src', relativePath), 'utf-8');
}

/** Lo único que aplica el inset de verdad; el resto lo delega en un hijo. */
const APLICA_INSET = /useSafeAreaInsets|useInsetSuperior|<SafeAreaView/;

function existeComponente(nombre: string): boolean {
  return fs.existsSync(path.resolve(__dirname, '../../src/components', `${nombre}.tsx`));
}

/**
 * ¿El componente aplica el inset, propio o por alguno que monta? Sigue la
 * cadena porque casi ninguno lo hace en su propio archivo:
 * `TreeRegistrationHeader` → `CustomHeader` → `useInsetSuperior`, y
 * `EntityFormModal` → `ModalHeader` → `useSafeAreaInsets`.
 */
function resuelveElInset(rutaRelativa: string, visitados = new Set<string>()): boolean {
  if (visitados.has(rutaRelativa)) return false;
  visitados.add(rutaRelativa);
  const fuente = readSrc(rutaRelativa);
  if (APLICA_INSET.test(fuente)) return true;
  const montados = new Set(Array.from(fuente.matchAll(/<([A-Z]\w+)/g), (m) => m[1]));
  return Array.from(montados).some(
    (nombre) => existeComponente(nombre) && resuelveElInset(`components/${nombre}.tsx`, visitados),
  );
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

  // El catálogo no ofrece "Eliminar del dispositivo"; esa acción vive en la lista local (#520).
  it('does not expose handleDeletePlantation', () => {
    expect(hook).not.toContain('handleDeletePlantation');
  });
});

// --- Regression: safe area resuelto de verdad, no por estar envuelto (#336) ---
/**
 * Quién aplica el inset superior en cada pantalla. Es una tabla y no una lista
 * de wrappers aceptados a propósito: el guard viejo daba por buena una pantalla
 * que contuviera cualquiera de cuatro strings, y `ScreenContainer` —que no
 * aplica ningún inset— era uno de ellos. Con eso, `SettingsScreen` y
 * `PerfilScreen` habrían pasado con el bug de #289 adentro.
 */
const RESPONSABLE_DEL_INSET = {
  TreeRegistrationScreen: 'TreeRegistrationHeader',
  NNResolutionScreen: 'CustomHeader',
  NuevoGrupoScreen: 'EntityFormModal',
  PlantationDetailScreen: 'CustomHeader',
  CatalogScreen: 'CustomHeader',
  SettingsScreen: 'CustomHeader',
  PerfilScreen: 'CustomHeader',
};

describe('Safe area on refactored screens', () => {
  for (const [pantalla, responsable] of Object.entries(RESPONSABLE_DEL_INSET)) {
    it(`${pantalla} monta ${responsable}`, () => {
      expect(readSrc(`screens/${pantalla}.tsx`)).toMatch(new RegExp(`<${responsable}\\b`));
    });
  }

  for (const responsable of new Set(Object.values(RESPONSABLE_DEL_INSET))) {
    it(`${responsable} aplica el inset superior`, () => {
      expect(resuelveElInset(`components/${responsable}.tsx`)).toBe(true);
    });
  }

  // La red de la red. `ScreenContainer` es un View con flex: 1 y su propio
  // docstring lo aclara; envolver en él no resuelve nada.
  it('ScreenContainer por sí solo no cuenta', () => {
    expect(resuelveElInset('components/ScreenContainer.tsx')).toBe(false);
  });
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

// --- Regression: las tabs Ajustes y Perfil usan el header compartido (#289) ---
describe('Header unificado en las tabs (guía UX §6.1)', () => {
  // Que las dos monten CustomHeader lo cubre RESPONSABLE_DEL_INSET, arriba.
  const tabs = { SettingsScreen: readSrc('screens/SettingsScreen.tsx') };

  it('SettingsScreen no repite el título de la pantalla dentro de la card', () => {
    expect(tabs.SettingsScreen).toMatch(/<CustomHeader title="Ajustes"/);
    expect(tabs.SettingsScreen).not.toMatch(/styles\.cardTitle/);
  });

  it('el grupo de ajustes de GPS está rotulado', () => {
    expect(tabs.SettingsScreen).toContain('Ajustes GPS');
  });
});
