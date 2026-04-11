# Phase 11: Unificar pantallas — eliminar screen de Gestión e integrar acciones en PlantationCard - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate the "Gestión" tab/screen (AdminScreen) and consolidate all plantation management actions into enriched PlantationCards on PlantacionesScreen. The result: a single plantations screen with role-aware cards that replace the accordion-based management screen entirely.

</domain>

<decisions>
## Implementation Decisions

### Card Action Icons (D-01 through D-04)
- **D-01:** Right sidebar strip on PlantationCard with 3 vertically stacked icons: edit/pencil (top), gear (middle), trash (bottom). Extends the existing delete button column.
- **D-02:** Edit icon (lugar/periodo) visible for BOTH admin and tecnico roles.
- **D-03:** Gear icon visible ONLY for admin role.
- **D-04:** Tecnico cards maintain the 3-slot layout with an empty middle slot (where gear would be) for consistent card height across roles.

### Admin Actions Menu (D-05 through D-07)
- **D-05:** Tapping gear opens a bottom sheet (custom Modal with slide-up animation, NOT @gorhom/bottom-sheet). Shows the plantation name as header.
- **D-06:** Bottom sheet shows estado-specific actions matching current AdminScreen behavior:
  - **activa**: Configurar especies, Asignar técnicos, Finalizar
  - **finalizada**: Generar IDs, Exportar CSV, Exportar Excel
  - **sincronizada**: Exportar CSV, Exportar Excel
- **D-07:** Disabled actions (e.g., "Finalizar" when subgroups not synced) appear greyed out with a helper text explaining why they're blocked. Not hidden.

### Create Plantation Entry Point (D-08)
- **D-08:** "+" button in PlantacionesScreen header, next to the existing catalog/download icon. Admin sees both buttons ([+][⬇]); tecnico sees only the catalog button ([⬇]).

### Navigation Cleanup (D-09 through D-11)
- **D-09:** Admin tab layout goes from 3 tabs (Plantaciones, Gestión, Perfil) to 2 tabs (Plantaciones, Perfil) — identical to tecnico layout.
- **D-10:** Delete: `AdminScreen.tsx`, `admin.tsx` route wrapper, "Gestión" tab entry from admin `_layout.tsx`.
- **D-11:** Refactor: `usePlantationAdmin.ts` accordion/expand logic removed; admin action handlers (finalize, generateIds, export, create, edit, assignTech, discardEdit) reused via the hook but triggered from the bottom sheet instead. `AdminPlantationModals.tsx` adapted to work within PlantacionesScreen context.

### Claude's Discretion
- Bottom sheet component design (animation style, backdrop opacity, dismiss behavior)
- How to restructure `usePlantationAdmin` — may split into smaller hooks or merge relevant parts into `usePlantaciones`
- Whether `AdminPlantationModals` stays as-is or gets refactored into the new bottom sheet component

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Key Source Files
- `mobile/src/screens/AdminScreen.tsx` — Screen being eliminated. Study its actions and estado-specific logic.
- `mobile/src/screens/PlantacionesScreen.tsx` — Target screen that absorbs admin functionality.
- `mobile/src/components/PlantationCard.tsx` — Card being enriched with action icons sidebar.
- `mobile/src/hooks/usePlantationAdmin.ts` — Admin logic hook to be refactored/reused.
- `mobile/src/hooks/usePlantaciones.ts` — Plantaciones hook that may absorb admin handlers.
- `mobile/src/components/AdminPlantationModals.tsx` — Modal collection to adapt for new context.
- `mobile/app/(admin)/_layout.tsx` — Tab layout to remove Gestión tab.
- `mobile/app/(admin)/admin.tsx` — Route wrapper to delete.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `usePlantationAdmin` hook: all admin action handlers (finalize, generateIds, export, create, edit, assignTech, discardEdit) are already extracted and reusable
- `AdminPlantationModals` component: bundles create form, edit form, seed modal, confirm modal, species config, assign tech modals
- `ConfirmModal` component: existing modal pattern with backdrop — base for the new bottom sheet
- `FilterCards` component: already used in both AdminScreen and PlantacionesScreen
- `PlantationFormModal` component: create/edit plantation form
- `useConfirm` hook: modal state management pattern

### Established Patterns
- Screens use `ScreenHeader` + `TexturedBackground` wrapper
- Data hooks (`usePlantaciones`, `usePlantationAdmin`) encapsulate all data logic — screens are pure presentation
- Role detection via `useProfileData` (isAdmin) and `useRoutePrefix`
- `useLiveData` for reactive data from SQLite
- Estado-based color mapping via `colors.stateActiva`, `colors.stateFinalizada`, `colors.stateSincronizada`

### Integration Points
- `PlantacionesScreen` already renders `PlantationCard` in a FlatList — add icon props
- Admin `_layout.tsx` tab configuration — remove Gestión tab entry
- `PlantationCard` props — extend with `isAdmin`, `onEdit`, `onGear` callbacks
- PlantacionesScreen header `rightElement` — conditionally add "+" button for admin

</code_context>

<specifics>
## Specific Ideas

- Right sidebar strip layout: edit (top), gear (middle, admin-only), trash (bottom) — user specifically requested this layout over top-right corner or bottom bar alternatives
- Tecnico cards keep consistent 3-slot height even without gear icon (empty middle slot)
- @gorhom/bottom-sheet noted as future option for advanced use cases (photo gallery, swipeable content) but NOT for this phase — custom Modal is sufficient
- Admin and tecnico tab layouts become identical (2 tabs each), differentiation is purely in card content and header buttons

</specifics>

<deferred>
## Deferred Ideas

- Install `@gorhom/bottom-sheet` for advanced bottom sheet features (gesture-driven, snap points, scrollable content) — consider when adding photo gallery or similar swipeable UI
- Potential future: unify admin and tecnico `_layout.tsx` into a single shared layout since they'll be identical after this phase

None beyond the above — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-unificar-pantallas-eliminar-screen-de-gestion-e-integrar-sus-acciones-en-plantationcard*
*Context gathered: 2026-04-11*
