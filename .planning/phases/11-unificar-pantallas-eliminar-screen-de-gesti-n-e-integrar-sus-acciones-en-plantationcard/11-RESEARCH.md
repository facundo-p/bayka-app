# Phase 11: Unificar pantallas — eliminar screen de Gestión e integrar acciones en PlantationCard - Research

**Researched:** 2026-04-11
**Domain:** React Native UI refactor — screen consolidation, modal/bottom sheet, role-aware card actions
**Confidence:** HIGH (all findings from direct source code audit — no external library changes)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Right sidebar strip on PlantationCard with 3 vertically stacked icons: edit/pencil (top), gear (middle), trash (bottom). Extends the existing delete button column.
- **D-02:** Edit icon (lugar/periodo) visible for BOTH admin and tecnico roles.
- **D-03:** Gear icon visible ONLY for admin role.
- **D-04:** Tecnico cards maintain the 3-slot layout with an empty middle slot (where gear would be) for consistent card height across roles.
- **D-05:** Tapping gear opens a bottom sheet (custom Modal with slide-up animation, NOT @gorhom/bottom-sheet). Shows the plantation name as header.
- **D-06:** Bottom sheet shows estado-specific actions matching current AdminScreen behavior:
  - **activa**: Configurar especies, Asignar técnicos, Finalizar
  - **finalizada**: Generar IDs, Exportar CSV, Exportar Excel
  - **sincronizada**: Exportar CSV, Exportar Excel
- **D-07:** Disabled actions (e.g., "Finalizar" when subgroups not synced) appear greyed out with a helper text explaining why they're blocked. Not hidden.
- **D-08:** "+" button in PlantacionesScreen header, next to the existing catalog/download icon. Admin sees both buttons ([+][⬇]); tecnico sees only the catalog button ([⬇]).
- **D-09:** Admin tab layout goes from 3 tabs (Plantaciones, Gestión, Perfil) to 2 tabs (Plantaciones, Perfil) — identical to tecnico layout.
- **D-10:** Delete: `AdminScreen.tsx`, `admin.tsx` route wrapper, "Gestión" tab entry from admin `_layout.tsx`.
- **D-11:** Refactor: `usePlantationAdmin.ts` accordion/expand logic removed; admin action handlers (finalize, generateIds, export, create, edit, assignTech, discardEdit) reused via the hook but triggered from the bottom sheet instead. `AdminPlantationModals.tsx` adapted to work within PlantacionesScreen context.

### Claude's Discretion

- Bottom sheet component design (animation style, backdrop opacity, dismiss behavior)
- How to restructure `usePlantationAdmin` — may split into smaller hooks or merge relevant parts into `usePlantaciones`
- Whether `AdminPlantationModals` stays as-is or gets refactored into the new bottom sheet component

### Deferred Ideas (OUT OF SCOPE)

- Install `@gorhom/bottom-sheet` for advanced bottom sheet features (gesture-driven, snap points, scrollable content) — consider when adding photo gallery or similar swipeable UI
- Potential future: unify admin and tecnico `_layout.tsx` into a single shared layout since they'll be identical after this phase
</user_constraints>

---

## Summary

Phase 11 is a pure UI/navigation refactor with no new data layer changes. All data logic already exists — the phase is about reshuffling where that logic surfaces in the UI. The AdminScreen accordion is replaced by an enriched PlantationCard sidebar strip + an AdminBottomSheet component. The "Gestión" tab disappears; both roles converge on the same 2-tab layout.

The key engineering challenge is hook restructuring: `usePlantationAdmin` currently owns accordion state (`expandedId`, `expandedMeta`) and all admin action handlers. The accordion state becomes irrelevant; the action handlers must be accessible from `PlantacionesScreen` instead of `AdminScreen`. The metadata fetching logic (`checkFinalizationGate`, `hasIdsGenerated`) moves from a single-expanded model to a per-card on-demand model when the bottom sheet opens.

The UI-SPEC (11-UI-SPEC.md) is fully approved and is the canonical reference for visual details. All tokens, component dimensions, typography rules, and interaction flows are already locked.

**Primary recommendation:** Restructure in 5 discrete units: (1) hook refactor, (2) PlantationCard sidebar strip, (3) AdminBottomSheet new component, (4) PlantacionesScreen integration, (5) navigation cleanup + file deletions.

---

## Standard Stack

### Core (no new packages — all pre-existing)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| React Native `Modal` | SDK 55 | Bottom sheet implementation | `animationType="slide"`, already used in codebase |
| `@expo/vector-icons` Ionicons | pre-existing | Icons throughout | `settings-outline`, `create-outline`, `close-outline` |
| `react-native-reanimated` | pre-existing | Card enter animations | `FadeInDown` pattern already used in both screens |
| `expo-router` Tabs | pre-existing | Navigation tab layout | Remove one tab entry from admin `_layout.tsx` |

**No npm installs required.** The bottom sheet is built with `Modal` (animationType="slide") per D-05.

---

## Architecture Patterns

### Recommended File Layout After Phase 11

```
mobile/
├── app/
│   └── (admin)/
│       ├── _layout.tsx          # MODIFIED: 3 tabs → 2 tabs (remove admin tab)
│       ├── admin.tsx            # DELETED
│       ├── plantaciones.tsx     # unchanged
│       ├── perfil.tsx           # unchanged
│       └── plantation/          # unchanged
├── src/
│   ├── screens/
│   │   ├── PlantacionesScreen.tsx    # MODIFIED: absorb admin create + AdminPlantationModals
│   │   └── AdminScreen.tsx           # DELETED
│   ├── components/
│   │   ├── PlantationCard.tsx        # MODIFIED: sidebar strip with 3 slots
│   │   ├── AdminBottomSheet.tsx      # NEW: slide-up modal with estado-specific actions
│   │   └── AdminPlantationModals.tsx # MODIFIED: remove ConfirmModal (moved to PlantacionesScreen), keep rest
│   └── hooks/
│       ├── usePlantationAdmin.ts     # MODIFIED: strip accordion logic, keep action handlers
│       └── usePlantaciones.ts        # MODIFIED: call usePlantationAdmin internally OR pass via props
```

### Pattern 1: PlantationCard Sidebar Strip (3-slot column)

The existing `deleteButton` column is replaced with a structured 3-slot strip.

```typescript
// Source: mobile/src/components/PlantationCard.tsx (current structure to replace)
// Current: single deleteButton Pressable after content
// New: structured right strip with 3 slots

const STRIP_WIDTH = 48; // matches existing SIDEBAR_WIDTH constant

// Right strip structure:
// Slot 1 (top): edit icon — always rendered for both roles
// Slot 2 (mid): gear icon — only rendered when isAdmin=true; empty View for tecnico (same height)
// Slot 3 (bot): trash icon — only rendered when onDelete present (existing behavior)

// New props to add to PlantationCard:
type Props = {
  // ... existing props ...
  isAdmin?: boolean;
  onEdit?: () => void;
  onGear?: () => void;
  plantation?: { lugar: string; periodo: string; estado: string };
};
```

Key implementation note: Each slot must be 36px height with `hitSlop={8}` to achieve 44px touch target. The empty gear slot for tecnico must be an empty `View` with the same 36px height to preserve card height consistency (D-04).

Edit icon behavior varies by estado:
- `activa`: opens PlantationFormModal (edit mode)
- `finalizada` or `sincronizada`: shows helper text "No se puede editar una plantación finalizada" — use existing `showInfoDialog` pattern from `alertHelpers`

### Pattern 2: AdminBottomSheet Component

New component built with `Modal` (not @gorhom/bottom-sheet). Receives plantation data and metadata; renders estado-specific action lists.

```typescript
// Source: mobile/src/components/AdminBottomSheet.tsx (NEW)
// Uses same ActionItem pattern extracted from AdminScreen:

type Props = {
  visible: boolean;
  plantation: Plantation | null;
  meta: { canFinalize: boolean; idsGenerated: boolean };
  onDismiss: () => void;
  onConfigSpecies: () => void;
  onAssignTech: () => void;
  onFinalize: () => void;
  onGenerateIds: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
};
```

The `ActionItem` sub-component from AdminScreen can be copy-moved into AdminBottomSheet (or extracted to a shared location if reuse is expected). It is currently defined inside AdminScreen.tsx.

Modal visual spec from 11-UI-SPEC.md:
- `animationType="slide"`
- Top border radius: `borderRadius.xl` (16px) on top two corners only
- Drag handle: 4px × 40px, `colors.borderMuted`, centered, 8px from top
- Backdrop: full-screen pressable with `colors.overlay`

### Pattern 3: Metadata Fetching — Per-Card On-Demand

Currently `usePlantationAdmin` fetches `expandedMeta` for a single `expandedId`. After the refactor, metadata is needed when the bottom sheet opens for any card.

**Recommended approach:** Fetch metadata lazily when the gear icon is tapped (not on render). Store as local state in PlantacionesScreen or inside a `useAdminBottomSheet` mini-hook.

```typescript
// On gear tap:
const [bottomSheetMeta, setBottomSheetMeta] = useState<ExpandedMeta>({ canFinalize: false, idsGenerated: false });
const [bottomSheetPlantation, setBottomSheetPlantation] = useState<Plantation | null>(null);

async function handleOpenGear(plantation: Plantation) {
  setBottomSheetPlantation(plantation);
  // Fetch meta for this specific plantation
  const meta = await fetchMetaForPlantation(plantation);
  setBottomSheetMeta(meta);
  setBottomSheetVisible(true);
}
```

The `fetchMetaForPlantation` logic is already present in `usePlantationAdmin` inside the `useEffect` — extract it to a standalone async function.

### Pattern 4: usePlantationAdmin Refactor

**Logic to remove:**
- `expandedId`, `setExpandedId` state
- `expandedMeta`, `setExpandedMeta` state  
- `initialExpandDone` ref
- `handleToggleExpand` callback
- `handleToggleFilter` callback (this lives in `usePlantaciones` already via `setActiveFilter`)
- `filteredList` derivation (already in `usePlantaciones`)
- `counts` derivation (already in `usePlantaciones` as `estadoCounts`)
- The `useEffect` that auto-expands most-recent plantation
- The `useEffect` that fetches `expandedMeta` per `expandedId`

**Logic to keep (all action handlers):**
- `handleFinalize`
- `handleGenerateIds`
- `confirmSeedAndGenerate`
- `handleExportCsv`
- `handleExportExcel`
- `handleCreateSubmit`
- `handleAssignTech`
- `handleEditSubmit`
- `handleDiscardEdit`
- `seedModalPlantacionId`, `seedValue`, `setSeedValue`, `seedLoading`, `exportingId` state
- `confirmProps` / `useConfirm` instance

**New export needed:** Extract the `fetchMeta` logic into an exported async function so the caller can invoke it on-demand when opening the bottom sheet.

### Pattern 5: PlantacionesScreen Hook Integration

`PlantacionesScreen` currently calls only `usePlantaciones()`. After this phase it must also access admin action handlers. Two valid approaches:

**Option A (preferred for CLAUDE.md compliance):** Call `usePlantationAdmin()` inside `PlantacionesScreen` conditionally only when `isAdmin`, and spread its handlers as props to `AdminBottomSheet` and `AdminPlantationModals`. The two `useConfirm` instances (one from `usePlantaciones`, one from `usePlantationAdmin`) must be unified — one `ConfirmModal` at the screen level handles both.

**Option B:** Merge `usePlantationAdmin` handlers into `usePlantaciones`. Larger diff, less separation. Acceptable but higher merge risk.

**Recommendation:** Option A. Keep `usePlantacionAdmin` as a standalone hook, instantiate it in `PlantacionesScreen` only when `isAdmin`. The `confirmProps` from `usePlantacionAdmin` replaces/merges with the one from `usePlantaciones` — both currently render separate `ConfirmModal` instances. After merge, there should be only one `ConfirmModal` at screen level.

### Anti-Patterns to Avoid

- **Duplicate ConfirmModal:** Both `usePlantaciones` and `usePlantationAdmin` create a `useConfirm()` instance. If both are active, two ConfirmModals would be in the tree. Merge into one: either share a single `useConfirm` passed down, or have AdminPlantationModals consume the one from `usePlantacionAdmin` while `usePlantaciones` uses a separate instance for delete confirmations.
- **Calling checkFinalizationGate on every render:** Only fetch when bottom sheet opens. Calling it inside a `useEffect([plantationList])` would fire on every data refresh.
- **Hiding disabled actions in bottom sheet:** D-07 explicitly says disabled actions are shown greyed out, not hidden.
- **Edit icon navigating for finalizada/sincronizada:** The edit icon is visible for all estados but must show a helper dialog for locked estados — not open the form modal.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slide-up bottom sheet | Custom gesture recognizer | `Modal animationType="slide"` | Already decided (D-05); sufficient for this use case |
| Confirmation dialogs | New alert component | Existing `ConfirmModal` + `useConfirm` | Already in codebase; used by both hooks |
| Export loading overlay | New spinner component | `exportingId` pattern in `AdminPlantationModals` | Already implemented with `ActivityIndicator` overlay |
| Metadata for finalization check | New query | Existing `checkFinalizationGate`, `hasIdsGenerated` in `adminQueries` | These already do the right thing |
| Role detection | New auth check | `useRoutePrefix()` / `isAdmin` from `usePlantaciones` | Pattern established across all screens |
| ActionItem list row | New list component | Extract `ActionItem` from AdminScreen | Already fully styled and handles disabled state |

---

## Common Pitfalls

### Pitfall 1: Two ConfirmModal Instances Stacking
**What goes wrong:** `PlantacionesScreen` renders `<ConfirmModal {...confirmProps} />` from `usePlantaciones`. After absorbing admin actions, `usePlantationAdmin` also has its own `confirmProps`. If both are rendered, two overlapping modals can appear.
**Why it happens:** Each hook instantiates its own `useConfirm()`.
**How to avoid:** Either (a) pass a shared `showConfirm` callback from `usePlantaciones` into `usePlantationAdmin` so they share one modal, or (b) accept two separate modals knowing their `visible` state is mutually exclusive in practice (safe if no action can trigger both simultaneously).
**Warning signs:** Opening bottom sheet and then triggering a confirmation shows a second overlay.

### Pitfall 2: `e.stopPropagation()` Missing on Sidebar Icon Taps
**What goes wrong:** Tapping edit/gear/trash also fires `onPress` on the card (navigation to plantation detail).
**Why it happens:** The card is a `Pressable` — icon taps bubble up unless stopped.
**How to avoid:** All three sidebar icon `Pressable` components must call `e.stopPropagation()` in their `onPress`. Reference: existing `deleteButton` already does this correctly (`onPress={(e) => { e.stopPropagation(); onDelete(); }}`).
**Warning signs:** Tapping an action icon navigates away instead of opening modal.

### Pitfall 3: Card Height Inconsistency Without Empty Gear Slot
**What goes wrong:** Tecnico cards are shorter than admin cards because the gear slot is absent, making the list look misaligned.
**Why it happens:** If the gear icon is conditionally rendered without a placeholder, the strip height differs.
**How to avoid:** D-04 requires an empty `View` with the same 36px height in the gear slot position for tecnico cards.
**Warning signs:** List items have varying heights when switching between admin and tecnico test accounts.

### Pitfall 4: Bottom Sheet Opens Before Metadata Is Ready
**What goes wrong:** Bottom sheet appears with `canFinalize: false` and `idsGenerated: false` even for a finalized plantation — then updates after a flicker.
**Why it happens:** If the bottom sheet renders immediately while metadata is being fetched asynchronously.
**How to avoid:** Show a loading state in the bottom sheet while metadata loads, or fetch metadata first and only set `visible: true` after the fetch resolves. Given these are SQLite queries (fast), fetching first before showing is simpler.
**Warning signs:** Bottom sheet briefly shows wrong action set then changes.

### Pitfall 5: Accordion State Variables Left in usePlantationAdmin Export
**What goes wrong:** `usePlantationAdmin` still exports `expandedId`, `expandedMeta`, `handleToggleExpand`, etc. Code compiles but exports dead state, wasting memory and causing confusion.
**Why it happens:** Incomplete cleanup when only removing the accordion-related UI.
**How to avoid:** Remove all accordion state from the hook return value as part of the refactor task.

### Pitfall 6: Admin Tab Still Visible After Removing from _layout.tsx
**What goes wrong:** `admin.tsx` file still exists on disk. Expo Router auto-registers all files in the `(admin)` directory as routes. The tab entry is removed from `_layout.tsx`, but the file remains.
**Why it happens:** Expo Router file-based routing registers routes regardless of whether they appear in tab config.
**How to avoid:** Delete `admin.tsx` AND remove the tab config entry. Both must happen together (D-10).

---

## Code Examples

### Bottom Sheet Modal Skeleton

```typescript
// Source: pattern from ConfirmModal.tsx + UI-SPEC.md
// mobile/src/components/AdminBottomSheet.tsx (NEW)

import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export default function AdminBottomSheet({ visible, plantation, meta, onDismiss, ...actions }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      {/* Sheet */}
      <View style={[styles.sheet, { paddingBottom: spacing['5xl'] + insets.bottom }]}>
        {/* Drag handle */}
        <View style={styles.handle} />
        {/* Header */}
        <Text style={styles.header}>{plantation?.lugar}</Text>
        <Text style={styles.subheader}>{plantation?.periodo}</Text>
        {/* Estado-specific action list */}
        {plantation?.estado === 'activa' && <ActivaActions meta={meta} {...actions} />}
        {plantation?.estado === 'finalizada' && <FinalizadaActions meta={meta} {...actions} />}
        {plantation?.estado === 'sincronizada' && <SincronizadaActions {...actions} />}
      </View>
    </Modal>
  );
}
```

### Sidebar Strip (PlantationCard right column replacement)

```typescript
// Source: existing deleteButton pattern in PlantationCard.tsx, extended
// Strip replaces the single deleteButton with 3 slots

<View style={styles.strip}>
  {/* Slot 1: Edit */}
  <Pressable
    onPress={(e) => { e.stopPropagation(); onEdit?.(); }}
    hitSlop={8}
    style={({ pressed }) => [styles.stripSlot, pressed && { opacity: 0.5 }]}
    accessibilityLabel="Editar lugar y periodo"
  >
    <Ionicons name="create-outline" size={18} color={colors.primary} />
  </Pressable>

  {/* Slot 2: Gear (admin) or empty placeholder (tecnico) */}
  {isAdmin ? (
    <Pressable
      onPress={(e) => { e.stopPropagation(); onGear?.(); }}
      hitSlop={8}
      style={({ pressed }) => [styles.stripSlot, pressed && { opacity: 0.5 }]}
      accessibilityLabel="Acciones de gestión"
    >
      <Ionicons name="settings-outline" size={18} color={colors.primary} />
    </Pressable>
  ) : (
    <View style={styles.stripSlot} /> // empty placeholder — same height
  )}

  {/* Slot 3: Trash */}
  {onDelete && (
    <Pressable
      onPress={(e) => { e.stopPropagation(); onDelete(); }}
      hitSlop={8}
      style={({ pressed }) => [styles.stripSlot, pressed && { opacity: 0.5 }]}
      accessibilityLabel="Eliminar plantación del dispositivo"
    >
      <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
    </Pressable>
  )}
</View>

// styles.stripSlot = { height: 36, width: STRIP_WIDTH, alignItems: 'center', justifyContent: 'center' }
// styles.strip = { backgroundColor: colors.surface, justifyContent: 'center', gap: spacing.md }
```

### Header "+ " Button (Admin Only)

```typescript
// Source: PlantacionesScreen.tsx rightElement — extend existing pattern
// Admin sees two buttons: create (+) then catalog (download icon)

rightElement={
  <View style={styles.headerButtons}>
    {isAdmin && (
      <Pressable
        style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}
        onPress={() => setShowCreateModal(true)}
        accessibilityLabel="Nueva plantación"
      >
        <Ionicons name="add" size={18} color={colors.white} />
      </Pressable>
    )}
    <Pressable
      onPress={() => { if (isOnline) router.push(`/${routePrefix}/plantation/catalog` as any); }}
      disabled={!isOnline}
      // ... existing catalog button props unchanged
    >
      <Ionicons name="download-outline" size={18} color={isOnline ? colors.white : colors.offline} />
    </Pressable>
  </View>
}
```

### usePlantationAdmin Slimmed Export (after accordion removal)

```typescript
// Source: mobile/src/hooks/usePlantationAdmin.ts
// Remove from return object:
//   expandedId, expandedMeta, handleToggleExpand, handleToggleFilter, filteredList, counts
// Keep:
//   plantationList, seedModalPlantacionId, seedValue, setSeedValue, seedLoading,
//   exportingId, confirmProps, handleFinalize, handleGenerateIds, confirmSeedAndGenerate,
//   setSeedModalPlantacionId, handleExportCsv, handleExportExcel, handleCreateSubmit,
//   handleAssignTech, handleEditSubmit, handleDiscardEdit

// New export — fetchable on demand for bottom sheet metadata:
export async function fetchPlantationMeta(plantation: Plantation): Promise<ExpandedMeta> {
  let canFinalize = false;
  let idsGenerated = false;
  if (plantation.estado === 'activa') {
    const gate = await checkFinalizationGate(plantation.id);
    canFinalize = gate.canFinalize;
  }
  if (plantation.estado === 'finalizada') {
    idsGenerated = await hasIdsGenerated(plantation.id);
  }
  if (plantation.estado === 'sincronizada') {
    idsGenerated = true;
  }
  return { canFinalize, idsGenerated };
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Accordion row expand in AdminScreen | Bottom sheet per card | Richer interaction, role-aware |
| Separate "Gestión" tab for admin | Unified 2-tab layout for both roles | Simpler navigation |
| Admin actions only in AdminScreen | Admin actions accessible from PlantacionesScreen | Single entry point |
| `usePlantationAdmin` mixed accordion + action state | `usePlantationAdmin` pure action handlers only | Cleaner separation |

---

## Open Questions

1. **ConfirmModal ownership after merge**
   - What we know: Both `usePlantaciones` (delete confirmation) and `usePlantationAdmin` (finalize, generate IDs, discard) use separate `useConfirm()` instances.
   - What's unclear: Whether to unify into one shared `useConfirm` instance or allow two separate modal instances (mutually exclusive in practice).
   - Recommendation: Start with two separate instances (lower refactor risk). Both render a `ConfirmModal`; since delete and admin actions cannot fire simultaneously, there is no visual conflict. Can be unified later if needed.

2. **pendingEdit / discard flow in bottom sheet**
   - What we know: AdminScreen currently shows a "Cambios sin sincronizar" banner with a "Descartar" button in the expanded accordion content. This banner is based on `plantation.pendingEdit`.
   - What's unclear: Where this banner lives in the new flow — on the card itself (always visible) vs. inside the bottom sheet.
   - Recommendation: Show a `pendingEdit` indicator inline on the PlantationCard (similar to the existing `pendingSync` row), with the discard action accessible inside the bottom sheet. This keeps the card informative and the action in the right context.

3. **`useSafeAreaInsets` availability**
   - What we know: The AdminBottomSheet needs bottom padding to clear the device's home indicator bar.
   - What's unclear: Whether `react-native-safe-area-context` is already installed and providing a Provider.
   - Recommendation: Check `package.json` and existing usage before assuming. If already present (likely given Expo SDK 55), use `useSafeAreaInsets().bottom` in the sheet.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/component changes. No new external tools, CLIs, or services are introduced. No npm installs required.

---

## Validation Architecture

> workflow.nyquist_validation not explicitly set to false — included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (existing, configured in project) |
| Config file | jest.config.js or package.json jest field (existing) |
| Quick run command | `cd mobile && npx jest --testPathPattern=PlantationCard --passWithNoTests` |
| Full suite command | `cd mobile && npx jest --passWithNoTests` |

### Phase Requirements → Test Map

| Behavior | Test Type | Notes |
|----------|-----------|-------|
| PlantationCard renders sidebar strip with 3 slots | Unit | Snapshot or prop-driven render test |
| Gear icon absent for tecnico (isAdmin=false) | Unit | Conditional render check |
| Empty placeholder slot preserves card height | Unit | Style/layout assertion |
| Bottom sheet opens on gear tap | Integration | State change test |
| Edit icon for activa opens form modal | Integration | onEdit callback fires |
| Edit icon for finalizada shows info dialog | Integration | onEdit does not open form |
| Admin action handlers (finalize, export) remain callable | Unit | Verify hook still exports all expected functions |
| Admin tab removed from _layout.tsx | Manual | Visual navigation check |

### Wave 0 Gaps

- No new test files required — existing test infrastructure covers hook-level tests. Manual smoke testing sufficient for navigation changes (tab removal cannot be unit tested).

---

## Project Constraints (from CLAUDE.md)

- **No inline styling** — all styles via `StyleSheet.create()`.
- **Colors from theme only** — never hardcode hex values; use `colors.*` tokens from `src/theme.ts`.
- **No data logic in screens** — `PlantacionesScreen` must not call `db.*` directly; all data access stays in hooks/repositories.
- **Components under 20 lines of logic** — `AdminBottomSheet` internal action components should be extracted if individual renderers grow past 20 lines.
- **No code duplication** — `ActionItem` component should be defined once (inside `AdminBottomSheet.tsx`), not duplicated from `AdminScreen.tsx`.
- **Hooks as bridge, not logic** — metadata fetch logic (`checkFinalizationGate`, `hasIdsGenerated`) must stay in `queries/` layer; the hook or an exported function calls them.
- **ZERO queries in screens** — `PlantacionesScreen` must continue importing only from hooks, not from `queries/` or `repositories/` directly.
- **Single place change rule** — the `Plantation` type exported from `PlantationConfigCard.tsx` (which `usePlantationAdmin` imports) needs no changes; its fields cover all needed data.

---

## Sources

### Primary (HIGH confidence)

- Direct source audit of `mobile/src/screens/AdminScreen.tsx` — action inventory and estado-specific logic
- Direct source audit of `mobile/src/screens/PlantacionesScreen.tsx` — integration point for admin actions
- Direct source audit of `mobile/src/components/PlantationCard.tsx` — sidebar layout and SIDEBAR_WIDTH constant
- Direct source audit of `mobile/src/hooks/usePlantationAdmin.ts` — complete action handler inventory and accordion state to remove
- Direct source audit of `mobile/src/hooks/usePlantaciones.ts` — role detection, filter logic, confirm instance
- Direct source audit of `mobile/src/components/AdminPlantationModals.tsx` — full modal props interface
- Direct source audit of `mobile/app/(admin)/_layout.tsx` — current 3-tab layout to modify
- Direct source audit of `mobile/app/(admin)/admin.tsx` — thin wrapper to delete
- Direct source audit of `mobile/src/theme.ts` — all color/spacing/typography tokens confirmed
- `.planning/phases/11-.../11-CONTEXT.md` — all implementation decisions D-01 through D-11
- `.planning/phases/11-.../11-UI-SPEC.md` — visual contract (approved), component dimensions, interaction spec

### Secondary (MEDIUM confidence)

- React Native `Modal` `animationType="slide"` behavior — verified from existing codebase usage in `AdminPlantationModals.tsx`

---

## Metadata

**Confidence breakdown:**
- What to build: HIGH — decisions fully locked in CONTEXT.md, UI-SPEC approved
- Where files live: HIGH — direct source audit
- Hook refactor scope: HIGH — full audit of usePlantationAdmin exports
- Animation / bottom sheet behavior: HIGH — Modal API is pre-existing and confirmed working in codebase

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable codebase, no external dependencies)
