---
phase: 09-testing-strategy
plan: "02"
subsystem: mobile/screens/hooks/components
tags: [refactor, hooks, components, architecture, claude-md-rule-9]
dependency_graph:
  requires: []
  provides:
    - useTreeRegistration hook
    - useSpeciesOrder hook
    - useNNFlow hook
    - usePhotoCapture hook
    - TreeRegistrationHeader component
    - LastThreeTrees component
    - PhotoViewerModal component
    - TreeListModal component
    - TreeConfigModal component
    - SpeciesReorderModal component
    - ReadOnlyTreeView component
  affects:
    - mobile/src/screens/TreeRegistrationScreen.tsx
tech_stack:
  added: []
  patterns:
    - Hook extraction pattern (data logic in hooks, presentation in screens)
    - Component extraction for modal and view sections
    - usePhotoCapture wraps PhotoService to avoid service imports in screens
key_files:
  created:
    - mobile/src/hooks/useTreeRegistration.ts
    - mobile/src/hooks/useSpeciesOrder.ts
    - mobile/src/hooks/useNNFlow.ts
    - mobile/src/hooks/usePhotoCapture.ts
    - mobile/src/components/LastThreeTrees.tsx
    - mobile/src/components/TreeRegistrationHeader.tsx
    - mobile/src/components/PhotoViewerModal.tsx
    - mobile/src/components/TreeListModal.tsx
    - mobile/src/components/TreeConfigModal.tsx
    - mobile/src/components/SpeciesReorderModal.tsx
    - mobile/src/components/ReadOnlyTreeView.tsx
    - mobile/src/screens/TreeRegistrationScreen.styles.ts
  modified:
    - mobile/src/screens/TreeRegistrationScreen.tsx
    - mobile/src/hooks/useSpeciesOrder.ts
decisions:
  - "usePhotoCapture hook wraps usePhotoPicker + PhotoService to avoid service import in screen (CLAUDE.md rule 9)"
  - "ReadOnlyTreeView extracts read-only tree list section including reactivate bar"
  - "SpeciesReorderModal wraps GestureHandlerRootView + SpeciesReorderList — self-contained drag modal"
  - "TreeConfigModal as bottom-sheet style modal with all config options"
  - "Screen retained inline FlatList in read-only section originally, then extracted to ReadOnlyTreeView to hit <300 line target"
metrics:
  duration: "~25min"
  completed_date: "2026-04-09"
  tasks: 2
  files: 13
---

# Phase 09 Plan 02: TreeRegistrationScreen Decomposition Summary

Decomposed TreeRegistrationScreen from 1053 lines into focused hooks and components. Screen reduced to 286 lines (presentation-only). All business logic moved to hooks, all reusable UI extracted into components. Eliminates CLAUDE.md rule 9 violation (direct repository/service imports in screen).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extract hooks from TreeRegistrationScreen | 21902be | useTreeRegistration.ts, useSpeciesOrder.ts, useNNFlow.ts |
| 2 | Slim TreeRegistrationScreen + extract components | a126d09 | TreeRegistrationScreen.tsx (-767 lines), 8 new components, 1 new hook |

## What Was Built

**3 new hooks:**
- `useTreeRegistration` — tree CRUD (register, undo, finalize, reverse order, delete tree/subgroup, reactivate), loads subgroup data reactively, computes isOwner/isReadOnly/canReactivate
- `useSpeciesOrder` — species ordering, custom reorder state management, save reorder to UserSpeciesOrderRepository
- `useNNFlow` — N/N registration flow with photo capture

**1 wrapping hook:**
- `usePhotoCapture` — wraps `usePhotoPicker` + `launchCamera`/`launchGallery` from PhotoService to remove service import from screen

**7 new components:**
- `TreeRegistrationHeader` — custom header with tree count and N/N badge
- `LastThreeTrees` — last 3 trees display with undo chip
- `PhotoViewerModal` — photo fullscreen viewer with replace/remove actions
- `TreeListModal` — full tree list modal with delete/add-photo per tree
- `TreeConfigModal` — bottom-sheet options modal (reverse order + reorder species)
- `SpeciesReorderModal` — draggable species reorder modal
- `ReadOnlyTreeView` — read-only tree list with reactivate bar

**Screen after refactor:**
- 286 lines (from 1053)
- Zero imports from repositories, queries, or services
- Imports: useTreeRegistration, useSpeciesOrder, useNNFlow, usePhotoCapture
- Pure orchestration: route params → hooks → components

## Deviations from Plan

### Auto-added improvements

**1. [Rule 2 - Missing abstraction] usePhotoCapture hook**
- **Found during:** Task 2
- **Issue:** Acceptance criteria required "import.*Service" = 0. PhotoService (launchCamera/launchGallery) was imported directly in screen, passed to usePhotoPicker
- **Fix:** Created usePhotoCapture hook that wraps usePhotoPicker + PhotoService internally. Screen uses usePhotoCapture(confirm.show) and gets pickPhoto without knowing about PhotoService
- **Files:** mobile/src/hooks/usePhotoCapture.ts
- **Commit:** a126d09

**2. [Rule 2 - CLAUDE.md rule 9] Additional component extractions**
- **Found during:** Task 2
- **Issue:** Target was <300 lines, but extracting only 3 named components (SpeciesGrid, LastThreeTrees, TreeRegistrationHeader) left the screen at 796 lines due to 4 modal sections and a read-only tree list
- **Fix:** Created additional components: PhotoViewerModal, TreeListModal, TreeConfigModal, SpeciesReorderModal, ReadOnlyTreeView to bring screen to 286 lines
- **Commit:** a126d09

**3. [Rule 1 - Type consistency] useSpeciesOrder ReorderItem type**
- **Found during:** Task 2
- **Issue:** useSpeciesOrder defined its own ReorderSpeciesItem type identical to ReorderItem from SpeciesReorderList — would cause type incompatibility when passing to SpeciesReorderModal
- **Fix:** Updated useSpeciesOrder to import and use ReorderItem from SpeciesReorderList directly
- **Files:** mobile/src/hooks/useSpeciesOrder.ts
- **Commit:** a126d09

## Known Stubs

None. All behavior preserved from original screen.

## Self-Check: PASSED

Verified created files exist:
- mobile/src/hooks/useTreeRegistration.ts ✓
- mobile/src/hooks/useSpeciesOrder.ts ✓
- mobile/src/hooks/useNNFlow.ts ✓
- mobile/src/hooks/usePhotoCapture.ts ✓
- mobile/src/components/LastThreeTrees.tsx ✓
- mobile/src/components/TreeRegistrationHeader.tsx ✓
- mobile/src/components/PhotoViewerModal.tsx ✓
- mobile/src/components/TreeListModal.tsx ✓
- mobile/src/components/TreeConfigModal.tsx ✓
- mobile/src/components/SpeciesReorderModal.tsx ✓
- mobile/src/components/ReadOnlyTreeView.tsx ✓
- mobile/src/screens/TreeRegistrationScreen.tsx (286 lines) ✓

Verified commits exist:
- 21902be ✓
- a126d09 ✓

Verified acceptance criteria:
- TreeRegistrationScreen.tsx is 286 lines (< 300) ✓
- TreeRegistrationScreen.tsx has 0 "import.*Repository|Service|queries" ✓
- TreeRegistrationScreen.tsx imports useTreeRegistration, useSpeciesOrder, useNNFlow ✓
- SpeciesGrid (SpeciesButtonGrid) exists ✓
- LastThreeTrees.tsx exists ✓
- TreeRegistrationHeader.tsx exists ✓
- Hooks don't import from screens/ ✓
- Pre-existing test failures unchanged (ExportService.test.ts) ✓
