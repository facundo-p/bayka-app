# Phase 17: UI Parcelas + GruposScreen refactor + textos visibles - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning
**Source:** Derived from ROADMAP.md Phase 17 + UX decisions confirmadas con usuario 2026-05-27

<domain>
## Phase Boundary

Implementar la navegación 4-niveles **Plantación → Parcela → Grupo → Árbol** en la UI, agregar todas las pantallas y modales para CRUD de Parcelas, refactorizar `GruposScreen` para que sea scoped a una Parcela, y renombrar todos los textos visibles `"Subgrupo"`/`"subgrupo"` → `"Grupo"`/`"grupo"`.

**En scope (Phase 17):**
- `ParcelasScreen` (lista por plantación, header `+`, empty state, long-press edit, OrangeDot).
- `ParcelaRow` componente reutilizable (nombre, código, conteo grupos, conteo árboles, OrangeDot — **sin descripción** visible).
- `ParcelaFormModal` **full-screen** (crear y editar — mismo patrón en ambos casos), con char counter live para `descripcion`, validación de unicidad on submit, delete blocked por hijos.
- `PlantationCard` con sección expandible inline: fila inferior "Parcelas: N" con chevron; tap expande la lista de `ParcelaRow` como shortcut.
- Navegación: tap en `PlantationCard` (body) → `ParcelasScreen` (drilldown completo); tap en `ParcelaRow` (en screen o en card expandido) → `GruposScreen` scoped a parcela.
- `GruposScreen` refactor: recibir `parcelaId`, filtrar grupos, header `+` (eliminar botón inferior).
- Rename literal de textos visibles `"Subgrupo"`/`"Subgrupos"`/`"subgrupo"`/`"subgrupos"` → `"Grupo"`/`"Grupos"`/`"grupo"`/`"grupos"` en TODA la app (JSX strings, títulos, labels, mensajes de error, alerts, copy de buttons).
- Visual checkpoint final manual (sin guantes — los técnicos cargan datos sin guantes per usuario 2026-05-27).

**Fuera de scope (otras phases):**
- Feature flag `AUTO_PARCELA_DEFAULT` (crear parcela default al crear plantación) — Phase 18.
- Export CSV/Excel con columna Parcela — Phase 18.
- Tests E2E con Detox/Maestro del flujo completo Parcela en UI — fuera de scope v1.1 (UAT manual cubre).

</domain>

<decisions>
## Implementation Decisions

### Patrón de modal y forms
- **D-17-01:** `ParcelaFormModal` es **full-screen modal en AMBOS casos** (crear + editar). Decisión usuario 2026-05-27 — más consistente que mezclar bottom sheet (crear) con modal (editar). Pattern espejo del `NuevoGrupoScreen` actual (ex-NuevoSubgrupoScreen).
- **D-17-02:** Char counter live para `descripcion` (ej. "1234 / 10000"). Color cambia a warning cuando se acerca al límite (ej. ≥9000 chars).
- **D-17-03:** Validación de unicidad de `nombre`/`codigo` **on submit** (no on blur — evita flashes mid-typing). Pattern: invocar `ParcelaRepository.create`/`update`; capturar `UniqueConstraintError`; mostrar inline en el campo correspondiente.
- **D-17-04:** Delete bloqueado por hijos: botón Delete en form de edición invoca `ParcelaRepository.delete` (que hace tombstone); si lanza `HasChildrenError`, muestra modal de error "No se puede borrar la parcela porque tiene grupos asociados". Sin opción de cascade.

### Lista de parcelas
- **D-17-05:** `ParcelaRow` muestra **solo** `nombre`, `codigo`, `groupsCount`, `treesCount`, `OrangeDot`. **NO** muestra `descripcion` (D-17-05 decisión 2026-05-27 — oculta siempre, accesible solo en form de edición).
- **D-17-06:** Long-press en `ParcelaRow` abre `ParcelaFormModal` en modo editar. Single tap navega a `GruposScreen` scoped. **NO** hay 3-dot menu adicional.
- **D-17-07:** Empty state en `ParcelasScreen` cuando no hay parcelas: mensaje + CTA grande "Crear primera parcela".
- **D-17-08:** Header de `ParcelasScreen` tiene icono `+` a la derecha. Tap abre `ParcelaFormModal` en modo crear.

### Navegación + PlantationCard
- **D-17-09:** Tap en body de `PlantationCard` → navega a `ParcelasScreen` (en lugar del comportamiento anterior que iba directo a `GruposScreen`).
- **D-17-10:** `PlantationCard` tiene fila inferior nueva: "Parcelas: N" con chevron `>` rotatable. Tap en esa fila expande inline una sección con la lista de `ParcelaRow` (mismo componente). Sirve como shortcut para navegar a grupos sin pasar por `ParcelasScreen`.
- **D-17-11:** Doble interacción explícita: body del card → screen completa de parcelas; chevron row → expansión inline (vista rápida). Ambas accesibles, ambas suman a UX.
- **D-17-12:** Tap en `ParcelaRow` inline (dentro del card expandido) → navega a `GruposScreen` scoped (mismo flujo que en `ParcelasScreen`); long-press → mismo `ParcelaFormModal` de edición.
- **D-17-13:** Estado expandido del card es **local** (`useState`), no persiste en SQLite. Al cerrar la app o cambiar de pantalla, se resetea a colapsado.
- **D-17-14:** Animación expand/collapse usa `LayoutAnimation` o `Animated.View` con `height` interpolation (preferencia: `LayoutAnimation` por simplicidad; pattern existente en otros expandibles del repo).

### GruposScreen refactor
- **D-17-15:** `GruposScreen` ahora recibe `parcelaId` como route param (no solo `plantacionId` como antes). Si falta `parcelaId`, fallback es ir a `ParcelasScreen` (navegación defensiva).
- **D-17-16:** `GruposScreen` filtra grupos por `parcelaId` (no por `plantacionId`). Query nueva o extensión de `useGroups` para aceptar parcela filter.
- **D-17-17:** Al crear un grupo desde `GruposScreen`, auto-asigna `parcelaId` (de la route param). No hay selector adicional de parcela.
- **D-17-18:** Header de `GruposScreen` tiene icono `+` a la derecha. Tap abre `NuevoGrupoScreen` (o el modal nuevo, según pattern actual). El botón inferior "Agregar grupo" se ELIMINA (criterio ROADMAP #8: consistencia con Plantaciones y Parcelas).
- **D-17-19:** Title de `GruposScreen` muestra el nombre de la parcela (no el de la plantación) para que el técnico sepa scope visual. Ej: `"Loma-P1 — Grupos"`.

### Textos visibles
- **D-17-20:** Rename literal `"Subgrupo"`/`"Subgrupos"`/`"subgrupo"`/`"subgrupos"` → `"Grupo"`/`"Grupos"`/`"grupo"`/`"grupos"` en toda la app. Decisión usuario 2026-05-27: **sin casos especiales de concordancia de género** (rename literal directo funciona para todos los strings actuales).
- **D-17-21:** Scope del rename: JSX strings, títulos de screens, labels de inputs, mensajes de error/confirmación, alerts, copy de buttons, breadcrumbs. NO incluye: comentarios de código, nombres de archivos `.planning/` históricos, nombres de migrations.

### Visual checkpoint final
- **D-17-22:** Visual checkpoint manual al final de Plan 17-03: cargar la app en device Android, verificar navegación completa 4-niveles, verificar expansión `PlantationCard`, verificar long-press edit, verificar empty state, verificar rename textos. Decisión usuario 2026-05-27: **NO** se requiere prueba con guantes — los técnicos cargan datos sin guantes. Target táctil mínimo igual queda 44×44 (Material/HIG standard).

### Claude's Discretion
- Estructura exacta de archivos: si `ParcelaFormModal` es un screen standalone (`NuevaParcelaScreen.tsx` + `EditarParcelaScreen.tsx`) o un solo componente con prop `mode`. Preferencia: un solo componente con `mode='create' | 'edit'` para evitar duplicación (CLAUDE.md §8).
- Exactamente qué componente reutilizable separa `ParcelaRow` de la versión inline en `PlantationCard` — preferencia: mismo componente, con prop `variant='standalone' | 'inline'` si necesita diferenciarse visualmente.
- Si `OrangeDot` se reutiliza directo del componente existente para grupos o se introduce variante específica de parcela. Preferencia: reutilizar `OrangeDot` si existe; si no, crear uno genérico parametrizado.
- Cómo se maneja la transición visual cuando una parcela tiene 0 grupos: mostrar empty state inline en el card expandido vs ocultar la sección. Preferencia: empty state minimal con CTA "Agregar grupo" (que abre el flujo de crear grupo scoped a esa parcela).

</decisions>

<canonical_refs>
## Canonical References

### Requirements y plan de milestone
- `.planning/REQUIREMENTS.md` §"Milestone v1.1 Requirements" — PUI-01..10 (UI parcelas), GUI-01..04 (GruposScreen refactor), TEST-PARC-04..05 (visual checkpoint + AUTO_PARCELA flag tests, este último en Phase 18).
- `.planning/PROJECT.md` §"Current Milestone: v1.1".
- `.planning/ROADMAP.md` §"Phase 17" — goal, 10 success criteria, lista de 3 plans.

### Phase 15 + 16 upstream
- `.planning/phases/15-schema-migration-data-consolidation/15-CONTEXT.md`
- `.planning/phases/16-code-layer-rename-parcelas-data-sync/16-CONTEXT.md` — decisiones D-16-19..22 (tombstone), D-16-04 (file renames).
- `.planning/phases/16-code-layer-rename-parcelas-data-sync/16-03-SUMMARY.md` — estado post-execution Phase 16.
- Memoria `project_v11_milestone_state.md` — estado actual del milestone.

### Data layer (ya existe — solo CONSUMIR, no modificar)
- `mobile/src/repositories/ParcelaRepository.ts` — CRUD + tombstone + validaciones (Phase 16-02).
- `mobile/src/queries/parcelaQueries.ts` — listByPlantacion, conteos, agregaciones (Phase 16-02).
- `mobile/src/hooks/useParcelas.ts` — reactive hook via useLiveData (Phase 16-02).

### Components/screens a tocar (Phase 17)
- **Nuevos:**
  - `mobile/src/screens/ParcelasScreen.tsx`
  - `mobile/src/components/ParcelaRow.tsx`
  - `mobile/src/screens/NuevaParcelaScreen.tsx` (full-screen modal patrón) — o componente único con `mode` prop.
  - Hook `useExpandedCard.ts` o similar para estado de PlantationCard expansion (opcional, puede ser inline `useState`).
- **A modificar (UI):**
  - `mobile/src/components/PlantationCard.tsx` — agregar fila expandible + chevron.
  - `mobile/src/screens/GruposScreen.tsx` (o `PlantationDetailScreen.tsx` si el grupos screen vive ahí) — refactor para recibir `parcelaId`, header `+`, eliminar botón inferior.
  - `mobile/src/screens/NuevoGrupoScreen.tsx` (ex `NuevoSubgrupoScreen`) — verificar que use `parcelaId` desde route param al crear grupo.
- **A modificar (rename textos):**
  - Todos los archivos `.tsx` en `mobile/src/screens/` y `mobile/src/components/` que contengan strings "Subgrupo"/"Subgrupos"/"subgrupo"/"subgrupos". Grep + audit antes y después de Plan 17-03.

### Routing (expo-router)
- `mobile/app/(admin)/*` y `mobile/app/(tecnico)/*` — rutas que mapean a screens. Probablemente añadir `parcelas.tsx` y `nueva-parcela.tsx`.
- `mobile/app/nuevo-subgrupo.tsx` — ruta existente, mantener el slug por compat (Phase 16-01 dejó esa decisión) — `// PHASE-17: renombrar ruta a 'nuevo-grupo'` comentado en su lugar.

### Convenciones
- `.claude/CLAUDE.md` §3 (≤20 líneas por función, no duplicar), §8 (centralizar tema), §9 (cero queries en pantallas — usar hooks/queries).
- Memoria `feedback_no_inline_styles.md`: no eliminar `.styles.ts`, extraer estilos centralizados.
- Memoria `feedback_no_duplicate_centralize.md`: `src/theme.ts` único fuente de colores/spacing.
- Memoria `feedback_spanish_naming.md`: Spanish para entidades.

### Estilos
- `mobile/src/theme.ts` — fuente única de colores, spacing, tipografía. ParcelaRow + ParcelasScreen + ParcelaFormModal deben importar de ahí.
- Existing `.styles.ts` files para los components análogos (PlantationCard, GruposScreen) — usar como pattern.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`useLiveData`** (Phase 13) — para reactividad de listas. `useParcelas` ya lo usa; `ParcelasScreen` lo consume.
- **`OrangeDot`** — componente que muestra el dot naranja de pending_sync. Reutilizar para parcelas.
- **`useConfirm`** hook (existente) — para confirmation modals (delete parcela).
- **`PlantationCard` actual** — base sobre la cual se agrega la fila expandible. Sus styles ya están centralizados en `.styles.ts`.
- **`GrupoForm` (ex `SubgrupoForm`)** — pattern para `ParcelaFormModal` (mismo layout de inputs + validaciones + char counter potencial).
- **`useNewGroup`** (ex `useNewSubgroup`) — pattern para `useNewParcela` hook (encapsular lógica de creación).

### Established Patterns
- **CLAUDE.md §9 (cero queries en screens):** `ParcelasScreen` consume `useParcelas(plantacionId)`. Cero `db.*` calls.
- **CLAUDE.md §8 (centralizar):** estilos vienen de `theme.ts`. Componentes con `.styles.ts` separado.
- **Header con `+` action:** ver patrones existentes en otras screens (PlantationsList probablemente).
- **Empty state:** ver patrones existentes (probablemente en PlantationsList cuando no hay plantations).
- **Long-press para edit:** patrón nuevo en este project; mirá si hay precedentes para alinear behavior.

### Integration Points
- **PlantationCard:** ya existe, se le agrega una fila inferior + chevron + lógica de expansión.
- **GruposScreen route signature:** cambia de `(plantacionId)` a `(plantacionId, parcelaId)`. Update navegación que llame esto desde otros lugares.
- **NuevoGrupoScreen:** debe recibir `parcelaId` route param y pasarlo al `groupsRepository.create`.
- **i18n approach:** el proyecto no tiene framework i18n — strings son hardcoded en JSX. El rename de textos visibles es un find+replace controlado (no modificar comentarios ni metadata).

### Conflict / regression risks
- **Navegación rota durante el rollout:** durante Phase 17 in-flight, navegación puede tener bugs. Solución: ejecutar tests + visual checkpoint antes de merge. Si hay route changes que rompen deep links pendientes, documentar.
- **PlantationCard performance:** agregar expansión inline puede afectar render de listas grandes (catalog screen). Validar que no degrada — usar `React.memo` si es necesario y mover queries de conteo a `parcelaQueries`.
- **Textos hardcodeados que dicen "Subgrupo" en mensajes de error:** estos vienen de `Alert.alert(...)`, `toast(...)`, etc. Plan 17-03 debe grep exhaustivo (case-insensitive, palabras completas y parciales).
- **Tests con strings:** algunos tests pueden referenciar strings literales tipo `expect(screen.getByText('Subgrupo'))`. Update tests junto con UI.

</code_context>

<specifics>
## Specific Ideas

- **Visual checkpoint final** (Plan 17-03): cargar app en device Android (no guantes), recorrer flujo completo: Login → Catalog → tap Plantation → ParcelasScreen → ver lista → tap Parcela → GruposScreen → ver grupos → atrás → expand inline en PlantationCard → tap inline parcela → GruposScreen → crear nueva parcela vía header `+` → crear nuevo grupo vía header `+` → registrar árbol nuevo. Cada paso valida que no hay textos viejos ("Subgrupo") y que la navegación funciona.
- **Empty state copy** preliminar: "Esta plantación todavía no tiene parcelas." + CTA "Crear primera parcela" (botón grande). Estilo de empty state consistente con otros del repo.
- **Long-press hint visual**: considerar si agregar un onboarding tooltip "Mantén presionado para editar" la primera vez que el técnico abre `ParcelasScreen`. Decisión: NO en v1.1, dejar para iteración posterior si emerge fricción.
- **Estado expandido**: cuando un técnico tiene varias plantaciones en catalog y expande una, las otras se mantienen colapsadas (state local por card).
- **Doble interacción explícita:** tap body del card = drill-down completo (ParcelasScreen); chevron row = shortcut inline. UX intencional, no accidente.

</specifics>

<deferred>
## Deferred Ideas

- **Feature flag `AUTO_PARCELA_DEFAULT`**: crear parcela default automáticamente al crear plantación (Phase 18).
- **Export CSV/Excel con columna Parcela**: Phase 18 (EXPO-PARC-01..02).
- **Tests E2E** (Detox / Maestro) del flujo Parcela: fuera de scope v1.1.
- **Onboarding tooltips** ("Mantén presionado para editar"): iteración posterior.
- **Reordenar parcelas** (drag-and-drop): no requerido en v1.1.
- **Filtros y búsqueda en `ParcelasScreen`**: requerido si una plantación tiene >10 parcelas; current max es 17 (SSS), borderline. Decisión: si la performance es aceptable, NO en v1.1.
- **GPS / coordenadas KML** por parcela: deferred MIIL.

</deferred>

---

*Phase: 17-ui-parcelas-grupos-refactor-textos*
*Context gathered: 2026-05-27*
