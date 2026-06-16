# Asunciones — Batch UI/Árbol (Issues #153, #154, #155)

Documento de asunciones tomadas para resolver de forma autónoma las tareas pedidas.
Cada decisión que no estaba 100% especificada se resolvió con el criterio más
coherente con la arquitectura existente y se lista acá.

## Issue #153 — "Resolver N/N" a nivel de plantación

1. **"Al entrar a una plantación" = pantalla de listado de parcelas
   (`ParcelasScreen`).** Es la primera pantalla al abrir una plantación
   (la vista de grupos requiere una parcela seleccionada). El banner de N/N
   se reubica ahí.
2. **El conteo ya era plantation-wide.** `getNNCountsPerGroup(plantacionId)` y
   la pantalla de resolución (`nn-resolution`) ya operaban sobre toda la
   plantación; el cambio es puramente de *ubicación del acceso*, no de scope.
3. Se **extrae** el banner a un componente compartido `NNResolutionBanner`
   (zero-duplication) y se **elimina** de la vista de grupos de parcela
   (`PlantationDetailHeader`).
4. Se conserva el aviso de "grupos finalizados con N/N pendientes"
   (`blockedByNN`) junto al banner, ahora en la pantalla de parcelas.

## Issue #154 — Headers

1. **"Un poco más grande"** = se sube el título de header de `fontSize.xxl` (18)
   a un token dedicado **`fontSize.headerTitle = 22`** en `theme.ts`, aplicado en
   `CustomHeader`. Token nuevo (no se toca `xxl`, usado por modales/listas) para
   no agrandar texto no relacionado.
2. Afecta a **todos los headers de navegación** porque todos usan `CustomHeader`
   (Plantaciones, Parcelas, Grupos, Resolución N/N, Catálogo) y
   `TreeRegistrationHeader` lo envuelve.
3. **Grupos**: título `"Grupos"`, subtítulo `<Nombre Parcela>`. Si no hay nombre
   de parcela, subtítulo vacío (fallback al título solo).
4. **Parcelas**: título `"Parcelas"`, subtítulo `<Nombre Plantación>` (campo
   `lugar`). Si no hay lugar, subtítulo vacío.

## Issue #155 — Detalle/edición de árbol

1. **Presentación como Modal full-screen** (`TreeDetailModal`), no como ruta
   de expo-router. Razón: el listado de árboles (`TreeListModal`) es un RN
   `Modal`; abrir una ruta por debajo de un Modal queda tapado. Un Modal apilado
   reusa el contexto de estado/gating ya calculado en `TreeRegistrationScreen`.
   Se ve como una "pantalla" (full-screen, igual que `TreeListModal`).
2. **Entradas al detalle**: tap sobre la fila del árbol tanto en el listado
   editable (`TreeListModal`) como en la vista de solo-lectura
   (`ReadOnlyTreeView`), para que sea accesible también en grupos finalizados y
   plantaciones finalizadas.
3. **Gating** (derivado de `plantacionEstado`, `subgroupEstado`, `isCreator`):
   - Grupo activo + plantación activa + creador → editar foto/GPS **y** eliminar.
   - Grupo finalizado + plantación activa + creador → editar foto/GPS, **sin**
     eliminar.
   - Plantación finalizada **o** no-creador → **solo lectura**.
   Se expone `plantacionEstado` desde `useTreeRegistration` (antes sólo interno).
4. **Nombre científico**: se agrega `nombreCientifico` al detalle vía una query
   nueva `getTreeDetail(treeId)` (join `species`), sin tocar `getTreesForGroup`.
5. **Captura de foto y GPS**: se reutilizan `usePhotoCapture`,
   `updateTreePhoto`, `updateTreeGps`/`recaptureTreeGps` y el watcher GPS de la
   pantalla. La captura GPS usa el último fix del watcher (mismo criterio que el
   alta de árbol); si no hay señal, se avisa sin crash.
6. **Eliminar desde el detalle**: cuando está permitido, reusa
   `deleteTreeAndRecalculate` (recalcula posiciones/subIds) y cierra el detalle.

## Estrategia de ramas/PRs

- PR #153 `feat/nn-plantation-level-153` → base `main`.
- PR #154 `feat/headers-title-subtitle-154` → base `feat/nn-plantation-level-153`
  (stacked: ambos tocan `ParcelasScreen`/`PlantationDetailScreen`).
- PR #155 `feat/tree-detail-edit-155` → base `main` (archivos independientes).
