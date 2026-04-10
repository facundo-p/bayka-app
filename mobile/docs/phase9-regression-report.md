# Phase 9 Regression Report

**Fecha:** 2026-04-10
**Branch:** `feature/testing-strategy`
**PR:** #11

## Contexto

Phase 9 (Testing Strategy) incluyó refactors de pantallas grandes para cumplir con CLAUDE.md rule 9 (separar lógica de datos de presentación). Se extrajeron hooks y componentes de 9 pantallas. Durante este proceso, varias funcionalidades se perdieron o degradaron.

Este documento registra las regresiones encontradas, sus causas raíz, los fixes aplicados y los tests creados para prevenir recurrencia.

## Resumen

- **10 regresiones** encontradas en total
- **13 archivos** modificados para los fixes
- **20 assertions** de regresión en `tests/screens/refactor-regression.test.ts`
- **Causa raíz común:** al extraer lógica de pantallas a hooks, los handlers/imports/UI se movieron al hook pero nunca se reconectaron con la pantalla

## Regresiones

### 1. PlantacionesScreen — `onDelete` no pasado a PlantationCard

| | |
|---|---|
| **Severidad** | Alta |
| **Archivos** | `hooks/usePlantaciones.ts`, `screens/PlantacionesScreen.tsx` |
| **Commit que lo rompió** | `f2b06cd` (refactor 09-03) |
| **Síntoma** | El botón de eliminar plantación local no aparecía en las cards |

**Causa:** `handleDeletePlantation()` existía en la pantalla original pero no se migró al hook `usePlantaciones`. El `PlantationCard` seguía aceptando `onDelete` como prop pero nadie se lo pasaba.

**Fix:** Agregado `handleDeletePlantation` al hook con los diálogos de confirmación originales (simple para plantaciones sin datos pendientes, doble confirmación para plantaciones con subgrupos sin sincronizar). Conectado `onDelete={() => handleDeletePlantation(item.id)}` en la pantalla. Agregado `ConfirmModal` al JSX.

---

### 2. AdminScreen — Workflow de pendingEdit completo perdido

| | |
|---|---|
| **Severidad** | Alta |
| **Archivos** | `hooks/usePlantationAdmin.ts`, `screens/AdminScreen.tsx` |
| **Commit que lo rompió** | `4463c76` (refactor 09-03) |
| **Síntoma** | No se mostraba badge de "Cambios sin sincronizar", no se podía descartar ediciones locales, se podía finalizar con ediciones pendientes |

**Causa:** Tres elementos relacionados no se migraron al hook:
1. `handleDiscardEdit` — handler que llamaba a `discardPlantationEdit()` del repository
2. Badge visual de "Pendiente de sync" / "Cambios sin sincronizar" con botón "Descartar"
3. Guard de `pendingEdit` en el botón Finalizar (antes deshabilitaba el botón si había ediciones pendientes)

**Fix:**
- Importado `discardPlantationEdit` en el hook
- Agregado `handleDiscardEdit` con diálogo de confirmación
- Corregido `handleFinalize` para checkear `pendingSync || pendingEdit`
- Restaurado badge UI en la card expandida
- Restaurado disabled condition en botón Finalizar
- Agregado texto helper "Sincroniza la plantación antes de finalizar"

---

### 3. PlantacionesScreen — `uploadPendingEdits` removido del refresh

| | |
|---|---|
| **Severidad** | Alta |
| **Archivos** | `hooks/usePlantaciones.ts` |
| **Commit que lo rompió** | `f2b06cd` (refactor 09-03) |
| **Síntoma** | Al hacer pull/refresh, ediciones locales de plantaciones podían ser sobreescritas sin haberse subido al servidor |

**Causa:** El `handleRefresh` original llamaba `await uploadPendingEdits()` antes de hacer `pullFromServer`. Al extraer al hook, esta llamada se omitió.

**Fix:** Importado `uploadPendingEdits` de SyncService y agregado `await uploadPendingEdits()` como primera operación dentro del try block de `handleRefresh`.

---

### 4. CatalogScreen — `localIds` perdió reactividad

| | |
|---|---|
| **Severidad** | Alta |
| **Archivos** | `hooks/useCatalog.ts` |
| **Commit que lo rompió** | `f2b06cd` (refactor 09-03) |
| **Síntoma** | Si una plantación se descargaba/eliminaba desde otro flujo, el catálogo no reflejaba el cambio hasta recargar manualmente |

**Causa:** El código original usaba `useLiveData(getLocalPlantationIds)` que se actualizaba reactivamente. Al extraer al hook, se reemplazó por `useState<Set<string>>` con actualizaciones manuales.

**Fix:** Reemplazado `useState` por `useLiveData(() => getLocalPlantationIds())`. Eliminadas todas las llamadas manuales a `setLocalIds`.

---

### 5. NNResolutionScreen — Guardar perdió contador de selecciones

| | |
|---|---|
| **Severidad** | Media |
| **Archivos** | `screens/NNResolutionScreen.tsx` |
| **Commit que lo rompió** | `f2b06cd` (refactor 09-03) |
| **Síntoma** | El botón Guardar mostraba solo "Guardar" en vez de "Guardar (3)" |

**Causa:** El hook `useNNResolution` exportaba `selections` pero la pantalla no lo destructuraba ni lo usaba en el label del botón.

**Fix:** Destructurado `selections` del hook. Cambiado texto del botón a `` Guardar${count > 0 ? ` (${count})` : ''} ``.

---

### 6-8. Safe area bottom perdido en 4 pantallas

| | |
|---|---|
| **Severidad** | Media |
| **Archivos** | `TreeRegistrationScreen.tsx`, `PlantationDetailScreen.tsx`, `NNResolutionScreen.tsx`, `NuevoSubgrupoScreen.tsx` |
| **Commit que lo rompió** | `a126d09`, `4463c76`, `f2b06cd` (refactors 09-02, 09-03) |
| **Síntoma** | En iPhones con home indicator, botones inferiores podían quedar tapados |

**Causa:** Las pantallas originales usaban `<ScreenContainer>` que internamente aplicaba `paddingBottom: insets.bottom` via `useSafeAreaInsets`. Al reemplazar por `<View>` o `<TexturedBackground>`, se perdió el padding inferior.

**Fix:** Agregado `import { useSafeAreaInsets } from 'react-native-safe-area-context'` y aplicado `paddingBottom: insets.bottom` al contenedor principal de cada pantalla.

---

### 9. CatalogScreen — SafeAreaView no funciona en Android

| | |
|---|---|
| **Severidad** | Media |
| **Archivos** | `screens/CatalogScreen.tsx` |
| **Commit que lo rompió** | `f2b06cd` (refactor 09-03) |
| **Síntoma** | En Android, el contenido podía superponerse con la barra de estado o navegación |

**Causa:** Se importaba `SafeAreaView` de `react-native` (que en Android es un no-op) en vez de `react-native-safe-area-context` (que funciona en ambas plataformas).

**Fix:** Reemplazado import a `react-native-safe-area-context`.

---

## Tests de regresion

**Archivo:** `mobile/tests/screens/refactor-regression.test.ts`

20 assertions organizadas por regresión:

| Grupo | Assertions | Qué verifica |
|-------|-----------|--------------|
| AdminScreen pendingEdit | 6 | Import de discardPlantationEdit, export de handleDiscardEdit, check de pendingEdit en handleFinalize, badge UI, disabled condition en Finalize |
| PlantacionesScreen uploadPendingEdits | 2 | Import y llamada a uploadPendingEdits en handleRefresh |
| CatalogScreen localIds | 2 | Uso de useLiveData (no useState) para localIds |
| Safe area insets (4 pantallas) | 8 | Cada pantalla tiene useSafeAreaInsets e insets.bottom |
| NNResolutionScreen Guardar | 2 | Destructuring de selections, count en texto del botón |
| CatalogScreen SafeAreaView | 1 | Import de react-native-safe-area-context |
| PlantacionesScreen delete | 2 | onDelete prop y handleDeletePlantation en hook |

## Lecciones

1. **Al extraer lógica a hooks, hacer un diff exhaustivo** del archivo original vs hook + pantalla para verificar que no se pierden handlers, imports, o UI condicional.
2. **Los wrappers (ScreenContainer, SafeAreaView) no son cosméticos** — proveen funcionalidad de layout. Al reemplazarlos, verificar qué funcionalidad se pierde.
3. **`useLiveData` vs `useState` no son intercambiables** — la reactividad se pierde al cambiar a state manual.
4. **Tests de regresión basados en source code** (grep/match en archivos) son baratos de escribir y detectan pérdidas de wiring antes de que lleguen a producción.
